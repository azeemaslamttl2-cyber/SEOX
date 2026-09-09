// Executes an automation rule.
//
// Extracted so the Automation endpoint and the background `run_rule` job share
// one implementation: a rule run from the page and a rule run on a schedule
// must draft the same posts, honour the same mode, and skip the same URLs.

import { getStoredDocument } from './mysql-storage.js';
import { createPost, listSources, markSource, parseJson, recordSources, listLocationServices } from './gbp-store.js';
import {
  defaultSitemapUrl,
  filterUrls,
  findServiceGaps,
  hashUrl,
  normaliseRuleConfig,
  readPageMeta,
  readSitemap,
} from './gbp-automation.js';
import { applyUtm, validatePost } from './gbp-posts.js';
import { generatePostCopy } from './gbp-ai.js';

async function resolveSitemapUrl(env, userId, projectId, config) {
  if (config.sitemapUrl) return config.sitemapUrl;
  const project = await getStoredDocument(env, `users/${userId}/projects`, projectId);
  const siteUrl = project?.fullUrl || project?.full_url || project?.domain;
  if (!siteUrl) {
    const error = new Error(
      'This project has no website URL, so pages cannot be discovered. Set a sitemap URL on the rule instead.'
    );
    error.status = 400;
    throw error;
  }
  return defaultSitemapUrl(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
}

// --- website_to_post -------------------------------------------------------

async function runWebsiteToPost(env, { userId, projectId, rule, config, location, connection }) {
  void connection;
  const sitemapUrl = await resolveSitemapUrl(env, userId, projectId, config);
  const entries = await readSitemap(sitemapUrl);
  const candidates = filterUrls(entries, { include: config.include, exclude: config.exclude });

  const hashed = [];
  for (const entry of candidates) {
    hashed.push({ url: entry.url, urlHash: await hashUrl(entry.url), title: null });
  }
  await recordSources(userId, projectId, rule.id, hashed);

  const fresh = await listSources(userId, projectId, {
    ruleId: rule.id,
    status: 'new',
    limit: config.maxPerRun,
  });

  if (rule.mode === 'manual') {
    return {
      discovered: hashed.length,
      queued: fresh.length,
      drafted: 0,
      sources: fresh.map(serializeSource),
      note: 'Rule is in manual mode: pages were discovered but no posts were drafted.',
    };
  }

  const drafted = [];
  const failures = [];

  for (const source of fresh) {
    try {
      const meta = await readPageMeta(source.url);
      const draft = await generatePostCopy(env, userId, {
        businessName: location.business_name,
        primaryCategory: location.primary_category,
        source: { url: source.url, title: meta.title, excerpt: meta.excerpt },
      });

      const ctaUrl = applyUtm(source.url, config.utm);
      const payload = {
        userId,
        projectId,
        locationRowId: location.id,
        topicType: 'STANDARD',
        summary: draft.summary,
        ctaType: draft.ctaType || config.ctaType || 'LEARN_MORE',
        ctaUrl,
        mediaUrl: config.useSourceImage ? meta.image : null,
        origin: 'website',
        sourceUrl: source.url,
      };

      const validation = validatePost(payload);
      if (!validation.valid) {
        await markSource(userId, source.id, {
          status: 'skipped',
          skipReason: validation.errors.join(' '),
        });
        failures.push({ url: source.url, errors: validation.errors });
        continue;
      }

      // approval mode parks the draft; auto mode schedules it.
      const scheduledAt =
        rule.mode === 'auto'
          ? new Date(Date.now() + (config.scheduleOffsetHours || 2) * 60 * 60 * 1000)
          : null;

      const post = await createPost({
        ...payload,
        status: rule.mode === 'auto' ? 'scheduled' : 'pending_approval',
        scheduledAt,
      });

      await markSource(userId, source.id, { status: 'drafted', postId: post.id });
      drafted.push({ url: source.url, postId: post.id, title: meta.title });
    } catch (error) {
      await markSource(userId, source.id, {
        status: 'error',
        skipReason: error?.message || 'Failed to draft a post.',
      });
      failures.push({ url: source.url, errors: [error?.message || 'Failed to draft a post.'] });
    }
  }

  return {
    discovered: hashed.length,
    queued: fresh.length,
    drafted: drafted.length,
    mode: rule.mode,
    posts: drafted,
    failures,
  };
}

// --- service_gap -----------------------------------------------------------

async function runServiceGap(env, { userId, projectId, rule, config, location }) {
  const sitemapUrl = await resolveSitemapUrl(env, userId, projectId, config);
  const entries = await readSitemap(sitemapUrl);
  const candidates = filterUrls(entries, { include: config.include, exclude: config.exclude });

  // Titles sharpen the match; a failed fetch still leaves the slug to work from.
  const withTitles = [];
  for (const entry of candidates.slice(0, 40)) {
    try {
      const meta = await readPageMeta(entry.url);
      withTitles.push({ url: entry.url, title: meta.title });
    } catch {
      withTitles.push({ url: entry.url, title: null });
    }
  }

  // Read the normalised projection; fall back to the raw profile when the
  // location has not been synced since the projection was introduced, so an
  // unsynced location does not report every page as a gap.
  const serviceRows = await listLocationServices(userId, location.id);
  const gbpServices = serviceRows.length
    ? serviceRows.map((row) => ({ label: row.label, description: row.description }))
    : ((parseJson(location.raw_profile, {}) || {}).serviceItems || []).map((item) => ({
        label: item.freeFormServiceItem?.label?.displayName || null,
        description:
          item.structuredServiceItem?.description ||
          item.freeFormServiceItem?.label?.description ||
          null,
      }));

  const gaps = findServiceGaps(withTitles, gbpServices);
  return {
    pagesChecked: withTitles.length,
    gbpServiceCount: gbpServices.length,
    gaps,
    recommendation: gaps.length
      ? `${gaps.length} service page${gaps.length === 1 ? '' : 's'} on the website ${gaps.length === 1 ? 'is' : 'are'} not listed as a service on the Business Profile.`
      : 'Every service page on the website has a matching GBP service.',
  };
}

/**
 * Run one rule, whichever entry point asked for it.
 */
export async function runRule(env, { userId, projectId, rule, location, connection }) {
  const config = normaliseRuleConfig(rule.rule_type, parseJson(rule.config, {}));
  if (rule.rule_type === 'website_to_post') {
    return runWebsiteToPost(env, { userId, projectId, rule, config, location, connection });
  }
  if (rule.rule_type === 'service_gap') {
    return runServiceGap(env, { userId, projectId, rule, config, location });
  }
  const error = new Error(`"${rule.rule_type}" is not a runnable rule type.`);
  error.status = 400;
  throw error;
}

export function summariseRuleRun(ruleType, result) {
  return ruleType === 'website_to_post'
    ? `${result.drafted} drafted of ${result.discovered} discovered`
    : `${result.gaps.length} gaps found`;
}
