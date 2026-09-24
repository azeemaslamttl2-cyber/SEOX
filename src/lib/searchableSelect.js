/**
 * The two pieces of arithmetic behind `components/ui/SearchableSelect.jsx`:
 * which options a query keeps, and which rows a scroll position renders.
 *
 * They live here rather than inside the component so they can be tested
 * without a DOM, the way the rest of this codebase tests its view logic.
 */

// Rows are a fixed height so the visible window can be computed from
// scrollTop alone. The component applies this as the row's inline height;
// the two must not drift apart.
export const ROW_HEIGHT = 36;
export const VIEWPORT_HEIGHT = ROW_HEIGHT * 7;
// Rendered above and below the visible window, so a fast scroll or an
// arrow-key step does not expose an unpainted gap.
export const OVERSCAN = 4;

function normalise(value) {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Case-insensitive, partial, and across everything the option is known by.
 *
 * `searchText` is matched alongside the label because the label is a display
 * string: for a Jira project it reads "ZC — Zero Carbon", and a user typing
 * the key expects a hit without having to reproduce the separator. Multiple
 * words match in any order - "carbon zero" is the same intent as "zero
 * carbon" - and an empty query returns the array unchanged, by identity, so
 * the unfiltered case costs nothing.
 */
export function filterOptions(options, query) {
  const terms = normalise(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return options;
  return options.filter((option) => {
    const haystack = normalise(`${option.searchText ?? ""} ${option.label} ${option.hint ?? ""}`);
    return terms.every((term) => haystack.includes(term));
  });
}

/**
 * The slice of rows to put in the DOM for a given scroll position.
 *
 * A Jira site with a few thousand boards would otherwise mean a few thousand
 * buttons on the page, rebuilt on every keystroke. Returns `[first, last)`
 * over the FILTERED list; the rows outside it are represented by spacer
 * divs, so the scrollbar still describes the whole list.
 */
export function visibleRange(count, scrollTop, viewportHeight = VIEWPORT_HEIGHT) {
  const safeTop = Math.max(0, scrollTop || 0);
  // `first` is clamped against the END of the list, not only against zero.
  // A scroll position outlives the list it was taken on - narrowing the
  // query, or switching internal project, can leave the list far shorter
  // than the offset - and an unclamped `first` then renders a tall top
  // spacer with no rows after it: a dropdown that is open and blank.
  const window = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const maxFirst = Math.max(0, count - window);
  const first = Math.min(Math.max(0, Math.floor(safeTop / ROW_HEIGHT) - OVERSCAN), maxFirst);
  const last = Math.min(count, Math.ceil((safeTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  return { first, last: Math.max(first, last) };
}

/**
 * Where the list must be scrolled to for `index` to be on screen, or `null`
 * when it already is.
 *
 * Arithmetic rather than scrollIntoView, which cannot see a row that
 * windowing has not rendered yet - the case that matters most, since that is
 * every row the keyboard is travelling towards.
 */
export function scrollTopFor(index, scrollTop, clientHeight) {
  const top = index * ROW_HEIGHT;
  const bottom = top + ROW_HEIGHT;
  if (top < scrollTop) return top;
  if (bottom > scrollTop + clientHeight) return bottom - clientHeight;
  return null;
}
