import test from "node:test";
import assert from "node:assert/strict";

import {
  BATCH_SCOPE_PREFIX,
  SITE_SCOPE,
  buildFingerprint,
  buildScopeKey,
  hashScopeKey,
  normalizeFindingType,
  normalizeModule,
  normalizeScopeUrl,
} from "../functions/_lib/jira-fingerprint.js";
import { findingKey, normalizeScopeUrl as clientNormalize } from "../src/lib/jiraFindings.js";

const base = {
  projectId: "acme-site",
  sourceModule: "auditor",
  findingType: "meta-description-missing",
  scope: { kind: "url", url: "https://example.com/blog/seo-guide" },
};

test("the same finding always produces the same fingerprint", () => {
  const a = buildFingerprint(base);
  const b = buildFingerprint({ ...base, scope: { ...base.scope } });
  assert.equal(a.fingerprint, b.fingerprint);
  assert.match(a.fingerprint, /^[0-9a-f]{64}$/);
});

test("URL differences that do not change the page collapse to one fingerprint", () => {
  // A trailing slash, a fragment and a capitalised host are the same page.
  // If these produced different fingerprints, one finding would file several
  // Jira issues.
  const variants = [
    "https://example.com/blog/seo-guide",
    "https://example.com/blog/seo-guide/",
    "https://example.com/blog/seo-guide#intro",
    "https://EXAMPLE.com/blog/seo-guide",
  ];
  const fingerprints = new Set(
    variants.map((url) => buildFingerprint({ ...base, scope: { kind: "url", url } }).fingerprint)
  );
  assert.equal(fingerprints.size, 1);
});

test("a different page, type or project is a different fingerprint", () => {
  const original = buildFingerprint(base).fingerprint;

  assert.notEqual(
    original,
    buildFingerprint({ ...base, scope: { kind: "url", url: "https://example.com/other" } }).fingerprint
  );
  assert.notEqual(
    original,
    buildFingerprint({ ...base, findingType: "title-tag-missing-or-empty" }).fingerprint
  );
  assert.notEqual(original, buildFingerprint({ ...base, projectId: "other-site" }).fingerprint);
  assert.notEqual(original, buildFingerprint({ ...base, sourceModule: "speed" }).fingerprint);
});

test("the on-page analyzer and a Screaming Frog import collapse onto the auditor", () => {
  // All three can report the same problem on the same URL. They must produce
  // ONE Jira issue, not three.
  const auditor = buildFingerprint(base).fingerprint;
  for (const module of ["onpage", "on-page", "screaming-frog", "screamingFrog", "crawl"]) {
    assert.equal(buildFingerprint({ ...base, sourceModule: module }).fingerprint, auditor, module);
  }
});

test("an unknown module falls back to auditor rather than inventing a namespace", () => {
  assert.equal(normalizeModule("something-new"), "auditor");
  assert.equal(normalizeModule("WPSCAN"), "wpscan");
});

test("finding types are normalised to the auditor slug character set", () => {
  assert.equal(normalizeFindingType("Meta Description Missing"), "meta-description-missing");
  assert.equal(normalizeFindingType("  4XX Page  "), "4xx-page");
  assert.equal(normalizeFindingType("a".repeat(300)).length, 191);
});

test("site-wide and batched findings have their own stable scopes", () => {
  assert.equal(buildScopeKey({ kind: "site" }), SITE_SCOPE);

  const urls = ["https://example.com/b", "https://example.com/a"];
  const first = buildScopeKey({ kind: "batch", urls });
  const reordered = buildScopeKey({ kind: "batch", urls: [...urls].reverse() });
  const withDuplicate = buildScopeKey({ kind: "batch", urls: [...urls, "https://example.com/a"] });

  // Order and duplicates must not change the identity of the same batch.
  assert.equal(first, reordered);
  assert.equal(first, withDuplicate);
  assert.ok(first.startsWith(BATCH_SCOPE_PREFIX));

  // A genuinely different set is a different issue.
  assert.notEqual(first, buildScopeKey({ kind: "batch", urls: [...urls, "https://example.com/c"] }));
});

test("scope kind is reported back so the caller does not have to re-derive it", () => {
  assert.equal(buildFingerprint(base).scopeKind, "url");
  assert.equal(buildFingerprint({ ...base, scope: { kind: "site" } }).scopeKind, "site");
  assert.equal(
    buildFingerprint({ ...base, scope: { kind: "batch", urls: ["https://example.com/a"] } }).scopeKind,
    "batch"
  );
});

test("a URL-scoped finding without a URL is rejected, not silently made site-wide", () => {
  assert.throws(() => buildFingerprint({ ...base, scope: { kind: "url" } }), /URL/i);
  assert.throws(() => buildFingerprint({ ...base, findingType: "" }), /finding type/i);
  assert.throws(() => buildFingerprint({ ...base, projectId: "" }), /project/i);
});

test("the scope key hash is index-safe for a maximum-length URL", () => {
  const long = `https://example.com/${"a".repeat(2000)}`;
  assert.match(hashScopeKey(long), /^[0-9a-f]{64}$/);
});

test("the client and the server normalise URLs identically", () => {
  // They must agree, or the badge on a findings row would not match the link
  // the server created. (A mismatch could never create a duplicate - the
  // database unique index prevents that - but it would look broken.)
  const samples = [
    "https://example.com/a/",
    "https://EXAMPLE.com/a#x",
    "https://example.com/",
    "not a url",
  ];
  for (const sample of samples) {
    assert.equal(clientNormalize(sample), normalizeScopeUrl(sample), sample);
  }
});

test("the client match key lines up with what the server stores on a link", () => {
  const { scopeKind } = buildFingerprint(base);
  const fromFinding = findingKey({
    sourceModule: "auditor",
    findingType: "meta-description-missing",
    url: "https://example.com/blog/seo-guide/",
    scopeKind,
  });
  const fromLinkRow = findingKey({
    sourceModule: "auditor",
    findingType: "meta-description-missing",
    url: "https://example.com/blog/seo-guide",
    scopeKind: "url",
  });
  assert.equal(fromFinding, fromLinkRow);
});
