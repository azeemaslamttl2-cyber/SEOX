import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  ROW_HEIGHT,
  VIEWPORT_HEIGHT,
  filterOptions,
  scrollTopFor,
  visibleRange,
} from "../../lib/searchableSelect.js";

/**
 * A single-choice dropdown with a search box inside it.
 *
 * Written for the lists a native `<select>` stops being usable on - a Jira
 * site with hundreds of boards, where the only way to find one is to scroll
 * past all the others. It is deliberately a drop-in replacement for such a
 * `<select>`: same `id` / `value` / `onChange(value)` / `disabled` contract,
 * so a field can be converted without touching the form around it.
 *
 * *** IT FILTERS THE LIST IT WAS GIVEN, AND NOTHING ELSE ***
 *
 * Every option is passed in already loaded, and typing only narrows that
 * array. The component never fetches, so a search cannot cost an API call
 * however fast the user types, and no debounce is needed: there is nothing
 * expensive on the other side of a keystroke to delay.
 *
 * Options are `{ value, label, hint?, searchText? }`. `searchText` is what
 * the query is matched against when the label alone is not what people
 * search by - a Jira project is hunted for by key as often as by name.
 */

export default function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No matches found.",
  disabled = false,
  className = "",
}) {
  const generatedId = useId();
  const listboxId = `${id || generatedId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value]
  );

  const matches = useMemo(() => filterOptions(options, query), [options, query]);

  // A new query invalidates both the highlight and the scroll position: the
  // list underneath them is a different list.
  useEffect(() => {
    setActiveIndex(0);
    setScrollTop(0);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [query]);

  const close = useCallback(({ focusTrigger = false } = {}) => {
    setOpen(false);
    setQuery("");
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  // A dropdown that outlives the field it belongs to is a stuck menu, and
  // the Jira project list is emptied whenever the internal project changes.
  useEffect(() => {
    if (disabled && open) close();
  }, [disabled, open, close]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) close();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  // Opening puts the caret in the search box and the highlight on whatever
  // is already selected, so the dropdown works entirely from the keyboard.
  useLayoutEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const index = Math.max(0, options.findIndex((option) => option.value === value));
    setActiveIndex(index);
    if (listRef.current) {
      const top = index * ROW_HEIGHT;
      listRef.current.scrollTop = top;
      setScrollTop(top);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Keeps the highlighted row inside the visible window. */
  const revealRow = useCallback((index) => {
    const list = listRef.current;
    if (!list) return;
    const next = scrollTopFor(index, list.scrollTop, list.clientHeight);
    if (next === null) return;
    list.scrollTop = next;
    setScrollTop(next);
  }, []);

  const commit = useCallback(
    (option) => {
      if (!option) return;
      onChange(option.value);
      close({ focusTrigger: true });
    },
    [onChange, close]
  );

  const moveActive = useCallback(
    (delta) => {
      if (!matches.length) return;
      setActiveIndex((current) => {
        const next = Math.min(matches.length - 1, Math.max(0, current + delta));
        revealRow(next);
        return next;
      });
    },
    [matches.length, revealRow]
  );

  function onSearchKeyDown(event) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        revealRow(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(matches.length - 1);
        revealRow(matches.length - 1);
        break;
      case "Enter":
        event.preventDefault();
        commit(matches[activeIndex]);
        break;
      case "Escape":
        event.preventDefault();
        close({ focusTrigger: true });
        break;
      case "Tab":
        close();
        break;
      default:
        break;
    }
  }

  function onTriggerKeyDown(event) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  }

  // *** ONLY THE VISIBLE ROWS ARE IN THE DOM ***
  // The rows above and below are represented by two spacer divs, so the
  // scrollbar still describes the whole list.
  const { first, last } = visibleRange(matches.length, scrollTop);
  const visible = matches.slice(first, last);

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onTriggerKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className="searchable-select-trigger flex w-full items-center gap-2 border px-3 py-2.5 text-left text-sm outline-none transition disabled:cursor-not-allowed"
      >
        <span className={`flex-1 truncate ${selected ? "" : "searchable-select-placeholder"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="searchable-select-panel absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border shadow-xl">
          <div className="searchable-select-search flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={listboxId}
              aria-autocomplete="list"
              className="w-full border-0 bg-transparent py-2.5 text-sm outline-none"
            />
          </div>

          {matches.length === 0 ? (
            <p className="searchable-select-empty px-3 py-4 text-sm">{emptyMessage}</p>
          ) : (
            <div
              id={listboxId}
              role="listbox"
              ref={listRef}
              onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
              style={{ maxHeight: VIEWPORT_HEIGHT }}
              className="overflow-y-auto overscroll-contain"
            >
              <div style={{ height: first * ROW_HEIGHT }} />
              {visible.map((option, offset) => {
                const index = first + offset;
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-active={index === activeIndex}
                    data-selected={isSelected}
                    style={{ height: ROW_HEIGHT }}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(option)}
                    className="searchable-select-option flex w-full items-center gap-2 px-3 text-left text-sm"
                  >
                    <span className="flex-1 truncate">{option.label}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
              <div style={{ height: Math.max(0, matches.length - last) * ROW_HEIGHT }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
