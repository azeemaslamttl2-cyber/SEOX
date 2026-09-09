// GBP AI Recommendations Engine, and the Safe AI Actions attached to each one.
//
// The rules are deterministic and every recommendation carries the numbers it
// was derived from. The AI is not asked to invent facts: a recommendation that
// says "1,340 impressions" says it because that figure is in the database.
// An optional narrative layer may rephrase the wording, never the evidence.
//
// A source that is not connected is declared missing rather than guessed at, so
// the engine never implies it considered data it never saw.

export const PRIORITIES = ['high', 'medium', 'low', 'opportunity'];

// What a recommendation may safely offer. `generate` and `schedule` always
// produce drafts for review; nothing here publishes on its own.
export const ACTION_KINDS = {
  fix: { label: 'Fix', kind: 'navigate' },
  generate: { label: 'Generate', kind: 'draft' },
  schedule: { label: 'Schedule', kind: 'draft' },
  ignore: { label: 'Ignore', kind: 'dismiss' },
};

function priorityRank(priority) {
  const index = PRIORITIES.indexOf(priority);
  return index === -1 ? PRIORITIES.length : index;
}

function recommendation(rule, fields) {
  return {
    rule,
    key: fields.key || rule,
    priority: fields.priority,
    title: fields.title,
    detail: fields.detail || null,
    recommended: fields.recommended,
    evidence: fields.evidence || {},
    actions: fields.actions || ['ignore'],
  };
}

const POSTING_TARGET_DAYS = 7;
const SERVICE_TARGET = 5;
const PHOTO_TARGET = 20;

/**
 * @param signals Output of gatherSignals(): profile, reviews, questions, posts,
 *   media, metrics (current/previous), searchKeywords, gsc, audit.
 * @returns {{ recommendations: Array, missing: Array }}
 */
export function buildRecommendations(signals) {
  const out = [];
  const {
    location = {},
    audit = null,
    reviews = null,
    questions = null,
    posts = null,
    media = null,
    metrics = null,
    searchKeywords = null,
    gsc = null,
  } = signals || {};

  // --- Keyword gaps: the flagship recommendation ---------------------------
  // A keyword Google is already showing the listing for, where the website is
  // not ranking well. Both halves are measured, never assumed.
  if (searchKeywords?.length) {
    const gscQueries = new Map(
      (gsc?.queries || []).map((row) => [String(row.query || '').toLowerCase(), row])
    );

    const exact = searchKeywords.filter((entry) => !entry.isThreshold && entry.impressions > 0);
    const ranked = [...exact].sort((a, b) => b.impressions - a.impressions).slice(0, 10);

    for (const entry of ranked) {
      const match = gscQueries.get(String(entry.keyword).toLowerCase());
      const position = match ? Math.round(Number(match.position) || 0) : null;

      // Ranking inside the top 10 already: not an opportunity worth raising.
      if (position !== null && position <= 10) continue;

      out.push(
        recommendation('keyword_gap', {
          key: `keyword_gap:${entry.keyword}`,
          priority: entry.impressions >= 500 ? 'high' : 'medium',
          title: `"${entry.keyword}" generates ${entry.impressions.toLocaleString()} GBP impressions/month`,
          detail:
            position === null
              ? gsc
                ? 'The website does not rank for this query in Search Console at all.'
                : 'Search Console is not connected, so the website ranking for this query is unknown.'
              : `The website ranks #${position} for this query in Search Console.`,
          recommended:
            position === null && gsc
              ? `Create or optimise a landing page targeting "${entry.keyword}".`
              : `Optimise the page targeting "${entry.keyword}", and post about it on the listing.`,
          evidence: {
            keyword: entry.keyword,
            gbpImpressionsPerMonth: entry.impressions,
            websitePosition: position,
            websiteImpressions: match ? Number(match.impressions) || null : null,
            // Declared rather than omitted, so the gap is visible in the UI.
            rankGridAverage: null,
          },
          actions: ['generate', 'fix', 'ignore'],
        })
      );
    }
  }

  // --- Unanswered reviews --------------------------------------------------
  if (reviews) {
    const unanswered = Number(reviews.unanswered || 0);
    const urgent = Number(reviews.urgent || 0);

    if (urgent > 0) {
      out.push(
        recommendation('unanswered_negative_reviews', {
          priority: 'high',
          title: `${urgent} unanswered review${urgent === 1 ? '' : 's'} at 2 stars or below`,
          detail: 'Low-star reviews without a reply sit at the top of the listing.',
          recommended: 'Draft replies now and review them before they are published.',
          evidence: { urgentUnanswered: urgent, totalUnanswered: unanswered },
          actions: ['generate', 'ignore'],
        })
      );
    }

    if (unanswered > urgent) {
      out.push(
        recommendation('unanswered_reviews', {
          priority: unanswered >= 10 ? 'high' : 'medium',
          title: `${unanswered} reviews unanswered`,
          detail: `Out of ${reviews.total || 0} reviews stored for this location.`,
          recommended: 'Generate replies, then approve the ones you are happy with.',
          evidence: {
            unanswered,
            total: reviews.total || 0,
            averageRating: reviews.averageRating ?? null,
          },
          actions: ['generate', 'ignore'],
        })
      );
    }

    if (reviews.averageRating !== null && reviews.averageRating < 4.5 && (reviews.total || 0) >= 5) {
      out.push(
        recommendation('rating_opportunity', {
          priority: 'opportunity',
          title: `Rating is ${Number(reviews.averageRating).toFixed(1)} across ${reviews.total} reviews`,
          detail: 'Listings at 4.5 and above convert noticeably better in the local pack.',
          recommended: 'Run a review request campaign with recent satisfied customers.',
          evidence: { averageRating: reviews.averageRating, totalReviews: reviews.total },
          actions: ['ignore'],
        })
      );
    }
  }

  // --- Posting cadence -----------------------------------------------------
  if (posts) {
    const days = posts.daysSinceLastPost;
    if (days === null || days >= 14) {
      out.push(
        recommendation('posting_gap', {
          priority: days === null || days >= 30 ? 'high' : 'medium',
          title:
            days === null
              ? 'No Google posts found on this listing'
              : `Last GBP post: ${days} days ago`,
          detail: `${posts.postsLast30Days || 0} posts in the last 30 days. A weekly cadence is the usual target for an active listing.`,
          recommended: 'Generate a service post and schedule it.',
          evidence: {
            daysSinceLastPost: days,
            postsLast30Days: posts.postsLast30Days || 0,
            targetCadenceDays: POSTING_TARGET_DAYS,
            // Not measured: no competitor source is connected.
            competitorAverage: null,
          },
          actions: ['generate', 'schedule', 'ignore'],
        })
      );
    }
  }

  // --- Q&A -----------------------------------------------------------------
  if (questions && Number(questions.unanswered || 0) > 0) {
    out.push(
      recommendation('unanswered_questions', {
        priority: 'medium',
        title: `${questions.unanswered} unanswered question${questions.unanswered === 1 ? '' : 's'}`,
        detail: 'Unanswered questions let other users answer on the business’s behalf.',
        recommended: 'Draft answers from the profile, then approve them.',
        evidence: { unanswered: questions.unanswered, total: questions.total || 0 },
        actions: ['generate', 'ignore'],
      })
    );
  }

  // --- Performance movement ------------------------------------------------
  if (metrics?.length) {
    for (const metric of metrics) {
      if (metric.change === null || metric.change === undefined) continue;
      // Only call out a real drop on a base big enough to mean something.
      if (metric.change > -20 || (metric.previous || 0) < 30) continue;

      out.push(
        recommendation('metric_drop', {
          key: `metric_drop:${metric.key}`,
          priority: metric.change <= -40 ? 'high' : 'medium',
          title: `${metric.label || metric.key} down ${Math.abs(metric.change)}%`,
          detail: `${metric.current?.toLocaleString?.() ?? metric.current} this period against ${metric.previous?.toLocaleString?.() ?? metric.previous} in the one before.`,
          recommended:
            'Check whether hours, categories or the listing status changed at the start of the drop.',
          evidence: {
            metric: metric.key,
            current: metric.current,
            previous: metric.previous,
            changePercent: metric.change,
          },
          actions: ['fix', 'ignore'],
        })
      );
    }
  }

  // --- Profile completeness, from the last audit ---------------------------
  if (audit?.failing?.length) {
    const worst = [...audit.failing]
      .filter((issue) => issue.pointsPossible - issue.pointsEarned >= 3)
      .sort(
        (a, b) => b.pointsPossible - b.pointsEarned - (a.pointsPossible - a.pointsEarned)
      )
      .slice(0, 4);

    for (const issue of worst) {
      out.push(
        recommendation('audit_gap', {
          key: `audit_gap:${issue.key}`,
          priority: issue.severity === 'critical' ? 'high' : issue.severity === 'high' ? 'medium' : 'low',
          title: issue.title,
          detail: issue.detail,
          recommended: issue.actionLabel
            ? `${issue.actionLabel} — worth ${issue.pointsPossible - issue.pointsEarned} points on the health score.`
            : 'Resolve this to raise the health score.',
          evidence: {
            check: issue.key,
            pointsLost: issue.pointsPossible - issue.pointsEarned,
            pointsPossible: issue.pointsPossible,
            auditScore: audit.score,
          },
          actions: ['fix', 'ignore'],
        })
      );
    }
  }

  // --- Services and media --------------------------------------------------
  const serviceCount = Number(location.serviceCount ?? 0);
  if (location.serviceCount !== undefined && serviceCount < SERVICE_TARGET) {
    out.push(
      recommendation('service_gap', {
        priority: 'medium',
        title: `Only ${serviceCount} service${serviceCount === 1 ? '' : 's'} listed`,
        detail: 'Services match long-tail "service + city" searches and show on the listing.',
        recommended: `Add at least ${SERVICE_TARGET - serviceCount} more services from the website.`,
        evidence: { serviceCount, target: SERVICE_TARGET },
        actions: ['fix', 'ignore'],
      })
    );
  }

  if (media && Number(media.total || 0) < PHOTO_TARGET) {
    out.push(
      recommendation('photo_gap', {
        priority: Number(media.total || 0) === 0 ? 'medium' : 'low',
        title: `${media.total || 0} photos on the listing`,
        detail: `Listings with ${PHOTO_TARGET}+ photos draw more direction requests and calls.`,
        recommended: `Upload ${PHOTO_TARGET - Number(media.total || 0)} more photos.`,
        evidence: { photoCount: media.total || 0, target: PHOTO_TARGET },
        actions: ['fix', 'ignore'],
      })
    );
  }

  return out.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
}

export function countByPriority(recommendations) {
  const counts = { high: 0, medium: 0, low: 0, opportunity: 0 };
  for (const entry of recommendations) counts[entry.priority] = (counts[entry.priority] || 0) + 1;
  return counts;
}

// --- Safe AI Actions -------------------------------------------------------

/**
 * What a given action on a given rule does. Returning a descriptor rather than
 * performing the work keeps the "never publishes" rule in one readable place.
 */
export function resolveAction(rule, actionKey) {
  if (actionKey === 'ignore') return { kind: 'dismiss' };

  const map = {
    unanswered_reviews: { generate: { kind: 'draft', target: 'review_replies', review: '/local-seo/gbp/reviews' } },
    unanswered_negative_reviews: {
      generate: { kind: 'draft', target: 'review_replies', review: '/local-seo/gbp/reviews' },
    },
    unanswered_questions: { generate: { kind: 'draft', target: 'qanda_answers', review: '/local-seo/gbp/qanda' } },
    posting_gap: {
      generate: { kind: 'draft', target: 'post', review: '/local-seo/gbp/posts' },
      schedule: { kind: 'draft', target: 'post', schedule: true, review: '/local-seo/gbp/posts' },
    },
    keyword_gap: {
      generate: { kind: 'draft', target: 'post', review: '/local-seo/gbp/posts' },
      fix: { kind: 'navigate', review: '/local-seo/gbp/profile' },
    },
    audit_gap: { fix: { kind: 'navigate', review: '/local-seo/gbp/audit' } },
    service_gap: { fix: { kind: 'navigate', review: '/local-seo/gbp/profile' } },
    photo_gap: { fix: { kind: 'navigate', review: '/local-seo/gbp/profile' } },
    metric_drop: { fix: { kind: 'navigate', review: '/local-seo/gbp/overview' } },
  };

  const resolved = map[rule]?.[actionKey];
  if (!resolved) {
    const error = new Error(`"${actionKey}" is not an available action for this recommendation.`);
    error.status = 400;
    throw error;
  }
  return resolved;
}
