// The searchable dropdown's two rules, tested away from React.
//
// It exists for the Jira project mapping field, where a site with hundreds
// of boards made the native <select> unusable. Three things are worth
// guarding:
//   1. WHAT A QUERY MATCHES - a Jira project is looked for by key as often
//      as by name, and the label joins the two with an em dash the user
//      will never type;
//   2. that searching stays a pure function of the list already loaded, so
//      a keystroke can never become a Jira request;
//   3. THE WINDOWING MATH - the reason a few thousand projects do not
//      become a few thousand DOM nodes.

import test from "node:test";
import assert from "node:assert/strict";

import {
  OVERSCAN,
  ROW_HEIGHT,
  VIEWPORT_HEIGHT,
  filterOptions,
  scrollTopFor,
  visibleRange,
} from "../src/lib/searchableSelect.js";

/** Jira projects as JiraPanel hands them to the dropdown. */
const PROJECTS = [
  { value: "1", label: "ZCW — Zero Carbon Website", searchText: "ZCW Zero Carbon Website" },
  { value: "2", label: "ZCM — Zero Carbon Mobile", searchText: "ZCM Zero Carbon Mobile" },
  { value: "3", label: "ZC — ZC Development", searchText: "ZC ZC Development" },
  { value: "4", label: "JBR — Jinnah Business Review", searchText: "JBR Jinnah Business Review" },
  { value: "5", label: "PGCM — PGC Merchandise", searchText: "PGCM PGC Merchandise" },
];

const labels = (options) => options.map((option) => option.label);

test("a name fragment matches every project carrying it", () => {
  assert.deepEqual(labels(filterOptions(PROJECTS, "zero")), [
    "ZCW — Zero Carbon Website",
    "ZCM — Zero Carbon Mobile",
  ]);
});

test("a project key matches, including as a prefix of longer keys", () => {
  // "ZC" is a key in its own right AND a prefix of ZCW and ZCM. Partial
  // matching is the point, so all three are correct here; what would be
  // wrong is missing the project whose key is exactly ZC.
  const found = labels(filterOptions(PROJECTS, "ZC"));
  assert.ok(found.includes("ZC — ZC Development"));
  assert.equal(found.length, 3);

  // A key that belongs to one project only narrows to that project.
  assert.deepEqual(labels(filterOptions(PROJECTS, "JBR")), ["JBR — Jinnah Business Review"]);
});

test("search is case-insensitive and ignores surrounding whitespace", () => {
  const expected = ["PGCM — PGC Merchandise"];
  assert.deepEqual(labels(filterOptions(PROJECTS, "pgc")), expected);
  assert.deepEqual(labels(filterOptions(PROJECTS, "PGC")), expected);
  assert.deepEqual(labels(filterOptions(PROJECTS, "  PgC  ")), expected);
});

test("partial matches anywhere in the name count, not just at the start", () => {
  assert.deepEqual(labels(filterOptions(PROJECTS, "usines")), ["JBR — Jinnah Business Review"]);
});

test("words match in any order, so the em dash in the label never blocks a hit", () => {
  // The user sees "ZCW — Zero Carbon Website" and types the key then the
  // name. Nobody reproduces the separator, so terms are matched
  // independently rather than as one substring.
  assert.deepEqual(labels(filterOptions(PROJECTS, "zcw website")), [
    "ZCW — Zero Carbon Website",
  ]);
  assert.deepEqual(labels(filterOptions(PROJECTS, "carbon zero")), [
    "ZCW — Zero Carbon Website",
    "ZCM — Zero Carbon Mobile",
  ]);
});

test("a query that matches nothing returns nothing, which is what renders the empty message", () => {
  // The panel shows "No Jira projects found." for this case. An empty
  // dropdown with no explanation is the thing being avoided.
  assert.deepEqual(filterOptions(PROJECTS, "kubernetes"), []);
});

test("an empty query returns the loaded list untouched", () => {
  // By identity: opening the dropdown must not rebuild the array, and a
  // whitespace-only query is not a query.
  assert.equal(filterOptions(PROJECTS, ""), PROJECTS);
  assert.equal(filterOptions(PROJECTS, "   "), PROJECTS);
});

test("filtering is pure - it never mutates or reorders the loaded list", () => {
  // The same array instance is reused across keystrokes, so anything that
  // wrote to it would corrupt the list the mapping form saves from.
  const before = PROJECTS.map((option) => option.value);
  filterOptions(PROJECTS, "zero");
  filterOptions(PROJECTS, "zc");
  assert.deepEqual(PROJECTS.map((option) => option.value), before);
  // Results keep the Jira ordering, so the list does not jump around as
  // the query is typed.
  assert.deepEqual(filterOptions(PROJECTS, "z").map((option) => option.value), ["1", "2", "3"]);
});

test("only a window of rows is rendered, however many projects Jira returns", () => {
  const { first, last } = visibleRange(5000, 0);
  assert.equal(first, 0);
  // Seven visible rows plus the overscan below - not 5000.
  assert.equal(last, VIEWPORT_HEIGHT / ROW_HEIGHT + OVERSCAN);
  assert.ok(last - first < 20);
});

test("the window follows the scroll position and keeps overscan on both sides", () => {
  const scrollTop = ROW_HEIGHT * 100;
  const { first, last } = visibleRange(5000, scrollTop);
  assert.equal(first, 100 - OVERSCAN);
  assert.equal(last, 100 + VIEWPORT_HEIGHT / ROW_HEIGHT + OVERSCAN);
});

test("the window never runs past either end of the list", () => {
  // Top of a short list: nothing above, and `last` cannot exceed the count
  // or the spacer below would be a negative height.
  assert.deepEqual(visibleRange(3, 0), { first: 0, last: 3 });
  // Bottom of a long one.
  const count = 500;
  const { last } = visibleRange(count, ROW_HEIGHT * count);
  assert.equal(last, count);
  // A filter that empties the list while it is scrolled leaves no rows
  // rather than a negative slice.
  assert.deepEqual(visibleRange(0, ROW_HEIGHT * 80), { first: 0, last: 0 });
});

test("a scroll offset left over from a longer list still renders rows", () => {
  // Scrolled a thousand projects deep, then the query narrows to five.
  // Clamping only at zero left `first` past the end, so the dropdown
  // rendered a tall spacer and nothing else: open, and blank.
  const { first, last } = visibleRange(5, ROW_HEIGHT * 1000);
  assert.equal(first, 0);
  assert.equal(last, 5);
});

test("keyboard travel scrolls only when the row is off screen", () => {
  const clientHeight = VIEWPORT_HEIGHT;
  // Already visible: no scroll, so the list does not twitch on every
  // arrow-key press.
  assert.equal(scrollTopFor(3, 0, clientHeight), null);
  // Below the fold: scrolled by exactly enough to show the row.
  assert.equal(scrollTopFor(7, 0, clientHeight), ROW_HEIGHT * 8 - clientHeight);
  // Above it: scrolled to sit the row at the top.
  assert.equal(scrollTopFor(2, ROW_HEIGHT * 10, clientHeight), ROW_HEIGHT * 2);
});

test("a row reached by keyboard is inside the window that will be rendered", () => {
  // The two halves have to agree, or arrowing down lands on a row that
  // windowing has not put in the DOM and the highlight disappears.
  const clientHeight = VIEWPORT_HEIGHT;
  let scrollTop = 0;
  for (let index = 0; index < 400; index += 1) {
    const next = scrollTopFor(index, scrollTop, clientHeight);
    if (next !== null) scrollTop = next;
    const { first, last } = visibleRange(400, scrollTop);
    assert.ok(index >= first && index < last, `row ${index} was not rendered`);
  }
});
