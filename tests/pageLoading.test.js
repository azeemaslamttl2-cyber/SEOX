import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { resolvePageState } from "../src/hooks/usePageLoading.js";

const LAYOUT_DIR = new URL("../src/layouts/", import.meta.url);
const layoutFiles = fs.readdirSync(LAYOUT_DIR).filter((name) => name.endsWith(".jsx"));

function read(relative) {
  return fs.readFileSync(new URL(relative, import.meta.url), "utf8");
}

test("cached data renders the page instead of a loader", () => {
  // ProjectsContext sets loading=true on every mount even when it resolves
  // from its cache. Gating on `loading` alone would blank a page that already
  // had everything it needed, which is the case point 10 of the brief calls out.
  const state = resolvePageState({ loading: true, hasData: true, slow: true });
  assert.equal(state.showLoader, false);
  assert.equal(state.showContent, true);
});

test("a fast load never flashes the loader", () => {
  // `slow` only turns true after the delay, so nothing is painted before then.
  const early = resolvePageState({ loading: true, hasData: false, slow: false });
  assert.equal(early.showLoader, false);
  assert.equal(early.showContent, false);

  const late = resolvePageState({ loading: true, hasData: false, slow: true });
  assert.equal(late.showLoader, true);
});

test("an error stops the loader and shows a recoverable state", () => {
  const state = resolvePageState({ loading: false, hasData: false, error: "Request failed" });
  assert.equal(state.showLoader, false);
  assert.equal(state.showError, true);
  assert.equal(state.showContent, false);
});

test("a failed background refresh keeps the content already on screen", () => {
  const state = resolvePageState({ loading: false, hasData: true, error: "Refresh failed" });
  assert.equal(state.showError, false);
  assert.equal(state.showContent, true);
});

test("a finished load with no rows renders the page, not an endless spinner", () => {
  // The empty case must reach the page so it can show its own empty state.
  const state = resolvePageState({ loading: false, hasData: false, slow: true });
  assert.equal(state.showLoader, false);
  assert.equal(state.showContent, true);
});

test("no combination of inputs leaves the page showing nothing at all", () => {
  // Guards against the stuck-forever screen: every state must resolve to a
  // loader, an error, or content.
  for (const loading of [true, false]) {
    for (const hasData of [true, false]) {
      for (const error of [null, "boom"]) {
        for (const slow of [true, false]) {
          const state = resolvePageState({ loading, hasData, error, slow });
          const shown = [state.showLoader, state.showError, state.showContent].filter(Boolean);
          const pendingAndQuick = state.pending && !slow;
          assert.ok(
            shown.length >= 1 || pendingAndQuick,
            `nothing rendered for ${JSON.stringify({ loading, hasData, error, slow })}`
          );
        }
      }
    }
  }
});

test("every layout routes its outlet through the shared loading boundary", () => {
  // The mechanism has to be global: a layout rendering a bare <Outlet/> would
  // be a page with no loading feedback and no error boundary.
  assert.ok(layoutFiles.length >= 15, "expected the full set of layouts");
  for (const name of layoutFiles) {
    const source = fs.readFileSync(new URL(name, LAYOUT_DIR), "utf8");
    assert.match(source, /<RouteOutlet/, `${name} does not use RouteOutlet`);
    assert.doesNotMatch(source, /<Outlet[\s/>]/, `${name} still renders a bare Outlet`);
  }
});

test("the boundaries sit inside the layout, so the shell survives a page load", () => {
  const source = read("../src/components/RouteOutlet.jsx");
  // Only the render body: the doc comment above it also names these elements.
  const body = source.slice(source.indexOf("return ("));
  // Error boundary outside Suspense: a lazy chunk that rejects has to be caught
  // rather than leaving the boundary suspended forever.
  const boundaryAt = body.indexOf("<RouteErrorBoundary");
  const suspenseAt = body.indexOf("<Suspense");
  const outletAt = body.indexOf("<Outlet");
  assert.ok(boundaryAt > -1 && suspenseAt > boundaryAt && outletAt > suspenseAt);
  assert.match(source, /fallback=\{<PageLoader/);
});

test("App keeps only a safety-net boundary around the routes", () => {
  const source = read("../src/App.jsx");
  assert.match(source, /<Suspense fallback=\{<PageLoader fullScreen \/>\}>/);
  // The old inline fallback replaced the whole shell with a bare "Loading...".
  assert.doesNotMatch(source, /function RouteLoading/);
});

test("a routed error is cleared by navigating, without remounting every page", () => {
  const source = read("../src/components/RouteErrorBoundary.jsx");
  assert.match(source, /getDerivedStateFromError/);
  assert.match(source, /getDerivedStateFromProps/);
  assert.match(source, /resetKey/);
  // Keying the boundary by pathname would remount pages on every navigation.
  assert.doesNotMatch(source, /key=\{pathname\}/);
});

test("the loader holds back before painting and is centred, not top-aligned", () => {
  const loader = read("../src/components/PageLoader.jsx");
  assert.match(loader, /delay = 200/);
  assert.match(loader, /setTimeout/);
  assert.match(loader, /role="status"/);

  const css = read("../src/index.css");
  const block = css.slice(css.indexOf(".page-loader {"), css.indexOf(".page-error {"));
  assert.match(block, /align-items: center;/);
  assert.match(block, /justify-content: center;/);
  // The accent must be set in CSS: `border-t-*` utilities are overwritten by
  // the compatibility layer's `[class*="border-white"]` border-color rule.
  assert.match(block, /border-top-color: var\(--brand-red\);/);
});
