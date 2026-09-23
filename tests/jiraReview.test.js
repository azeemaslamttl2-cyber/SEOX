// The review half of POST /api/jira/issues/status.
//
// Two things are worth pinning down and neither needs a Jira tenant:
//
//   1. WHEN A REVIEW EXISTS. This decides whether the endpoint comments at
//      all, and - because a request that names no status and carries no
//      review still means "resolve" - it also decides whether a ticket gets
//      moved. Reading a blank textarea as a review would post empty comments;
//      reading a real review as blank would close somebody's ticket.
//
//   2. WHAT REACHES JIRA. The v3 comment API takes Atlassian Document Format,
//      not a string, and the user's text must arrive as plain text rather
//      than as anything Jira would interpret.

import test from "node:test";
import assert from "node:assert/strict";

import { MAX_REVIEW_LENGTH, readReview, reviewToAdf } from "../functions/_lib/jira-review.js";

// --- What counts as a review ----------------------------------------------

test("a review is read from the request", () => {
  assert.equal(
    readReview({ review: "Reviewed and approved. Please proceed." }),
    "Reviewed and approved. Please proceed."
  );
});

test("`comment` is accepted as a synonym for `review`", () => {
  // The field is called a comment in Jira, so callers reach for that word.
  assert.equal(readReview({ comment: "Please update the screenshots." }), "Please update the screenshots.");
});

test("an absent review is no review", () => {
  assert.equal(readReview({}), "");
  assert.equal(readReview({ review: null }), "");
  assert.equal(readReview({ review: undefined }), "");
  assert.equal(readReview(undefined), "");
});

test("a blank review is treated exactly as an absent one", () => {
  // A form that always sends the field must not turn every status change into
  // a status change plus an empty Jira comment.
  assert.equal(readReview({ review: "" }), "");
  assert.equal(readReview({ review: "   " }), "");
  assert.equal(readReview({ review: "\n\t \r\n" }), "");
});

test("surrounding whitespace is stripped but the text is otherwise untouched", () => {
  assert.equal(readReview({ review: "  Looks good.  " }), "Looks good.");
  // Interior formatting is the user's, not ours to normalise.
  assert.equal(readReview({ review: "One.\n\nTwo." }), "One.\n\nTwo.");
});

test("a review that is not text is refused rather than coerced", () => {
  // String({}) would post "[object Object]" onto a customer's board.
  for (const value of [{ text: "hi" }, ["hi"], 42, true]) {
    assert.throws(
      () => readReview({ review: value }),
      (error) => error.status === 400 && error.code === "INVALID_REVIEW",
      `${JSON.stringify(value)} must not be accepted as a review`
    );
  }
});

test("a review longer than Jira will accept is refused by SEOX first", () => {
  // Jira's own limit is 32,767. Refusing here means the user gets a sentence
  // they can act on instead of a Jira 400 they cannot.
  const tooLong = "x".repeat(MAX_REVIEW_LENGTH + 1);
  assert.throws(
    () => readReview({ review: tooLong }),
    (error) => error.status === 400 && error.code === "REVIEW_TOO_LONG"
  );
  // The boundary itself is allowed.
  assert.equal(readReview({ review: "x".repeat(MAX_REVIEW_LENGTH) }).length, MAX_REVIEW_LENGTH);
});

// --- What reaches Jira -----------------------------------------------------

test("a review becomes an ADF document Jira's v3 comment API accepts", () => {
  const adf = reviewToAdf("Implementation completed. Please verify.");
  assert.equal(adf.type, "doc");
  assert.equal(adf.version, 1);
  assert.equal(adf.content.length, 1);
  assert.equal(adf.content[0].type, "paragraph");
  assert.deepEqual(adf.content[0].content, [
    { type: "text", text: "Implementation completed. Please verify." },
  ]);
});

test("each line becomes its own paragraph", () => {
  // An ADF text node is not defined to carry a line break, so a multi-line
  // review posted as one node comes back from Jira as a run-on sentence.
  const adf = reviewToAdf("First point.\nSecond point.\r\nThird point.");
  assert.equal(adf.content.length, 3);
  assert.deepEqual(
    adf.content.map((node) => node.content[0].text),
    ["First point.", "Second point.", "Third point."]
  );
});

test("blank lines do not become empty paragraphs", () => {
  const adf = reviewToAdf("Done.\n\n\nShipping now.");
  assert.equal(adf.content.length, 2);
});

test("the review is carried as plain text, never as markup Jira would render", () => {
  const hostile = '<script>alert(1)</script> h2. heading [link|http://example.com]';
  const adf = reviewToAdf(hostile);
  const node = adf.content[0].content[0];
  assert.equal(node.type, "text");
  // Verbatim, and with no marks - no link, no code, no emphasis inferred.
  assert.equal(node.text, hostile);
  assert.equal(node.marks, undefined);
});

test("a review of only whitespace still produces a well-formed document", () => {
  // readReview() rejects this case before it can get here; the conversion
  // must not throw if it ever does.
  const adf = reviewToAdf("   ");
  assert.equal(adf.type, "doc");
  assert.equal(Array.isArray(adf.content), true);
});
