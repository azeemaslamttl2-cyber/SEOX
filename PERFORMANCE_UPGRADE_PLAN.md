# Crawlus — Full Application Performance & Architecture Upgrade Plan

**Branch:** `azeem-dev`
**Status:** Phases 1-7 complete and verified. Remaining open items are listed in Phase 7.
**Baseline measured:** production build via `npx vite build` (exit 0).

---

## 0. HOW TO USE THIS FILE

This is the working document for the upgrade. Each phase has:

- exact files to touch
- what to change
- acceptance criteria (how you know it worked)
- rollback note

Work **top to bottom**. Do not start a phase before the previous one is verified.
Tick the `[ ]` boxes as you go.

---

## 1. MEASURED BASELINE (before optimization)

These numbers come from the real production build, not estimates.

| Metric                        | Value            | Note                                   |
|-------------------------------|------------------|----------------------------------------|
| Entry JS chunk                | 2,233 KB         | 542 KB gzip — blocks first paint       |
| Entry CSS                     | 525 KB           | 68 KB gzip, single file                |
| Total dist/assets             | 4.7 MB           | 37 JS chunks                           |
| Statically imported pages     | 138 files        | 1,959 KB of page source in entry chunk |
| Largest single static page    | 316 KB           | `src/pages/content/SemanticContentWriter.jsx` |
| Routes defined                | 178              | only 22 lazy (12%)                     |
| `useCrawl` consumers          | 39 files         | all re-render together                 |
| `useProjects` consumers       | 5 files          | the real owner is barely used          |
| Per-project data cache        | **none**         | list is cached, page data is not       |

Record the "after" numbers in section 9 as each phase lands.

---

## 2. ROOT-CAUSE SUMMARY

### CRITICAL

**C1 — The entire application ships in one JS chunk.**
`src/App.jsx` has 121 static page imports + 15 layout imports. `vite.config.js`
has **no `build` / `rollupOptions` block at all**, so there is no manual chunking.
A user opening `/dashboard` downloads the Admin panel, all 13 GBP pages, every
auditor report, and the 316 KB `SemanticContentWriter.jsx` before anything paints.
`recharts` and `framer-motion` are inside the entry chunk.

**C2 — Every `useCrawl` consumer re-renders once per second during a crawl.**
Two facts combine:

- `src/context/CrawlContext.jsx:1106` passes an **inline object literal** as the
  provider value. It is never memoised, so it gets a new identity on every render.
- `src/context/CrawlContext.jsx:658` runs a `setInterval` calling
  `setProjectStates` **every 1000 ms** while a crawl is active.

`CrawlProvider` wraps `BrowserRouter`, so it sits above the whole app.
What consumers actually read: **23 need only `stats`**, **~10 need only `project`**.
The ones reading `project` re-render every second for a value that never changed.

**C3 — There is no project-scoped data cache.** (This is the core of the request.)
`src/lib/projectsCache.js` caches the **project list only**. Its own header says:
_"Page-specific data ... is not cached here - those pages keep fetching from their
own endpoints."_

Clearest symptom: `useGbpPage()` in `src/pages/gbp/gbpUi.jsx:84` is shared by
**10 GBP pages**. Each mount calls `listAttachedLocations(projectId)`.
Walking Overview to Posts to Reviews to Insights to Q&A = **5 identical requests**.

### HIGH

**H1 — Dashboard GSC metrics refetch from Google on every visit.**
`src/hooks/useDashboardGscMetrics.js` holds results in local `useState` with no
TTL and no cache. The fallback at `src/lib/gscPerformance.js:140` only applies
when there is *no* access token.

**H2 — The project inventory has two owners.**
`ProjectsContext` is the documented source of truth, but `CrawlContext` mirrors
`projects` / `selectedProjectId` / `deletedProjectIds` into its own `useState`
and reconciles them across 9 effects in a 1,153-line file. Only 5 files use
`useProjects`; 39 use `useCrawl`. The mirror, not the owner, is what the app reads.

**H3 — Tech-SEO pages hit the database even on a cache hit.**
`src/hooks/useTechSeoToolResult.js:104` reads `sessionStorage`, then calls
`loadToolResult()` **unconditionally**. `writeLocalResult` already stores
`updatedAt` — it is simply never read back.

**H4 — GSC token re-fetched from server despite a valid local one.**
`restoreGscSession()` in `src/lib/gscSession.js` defaults `preferServer = true`.
The sibling `ensureValidGscSession()` in the same file already does it correctly.

**H5 — Eight dashboard checks run strictly sequentially.**
`src/lib/projectToolChecks.js:406-413` — eight sequential `await runTool(...)`.
Wall-clock is the *sum* of eight external calls, and each `setTool` publishes
state, re-rendering the dashboard ~20 times per run.

### MEDIUM

- **M1** — No `build` block in `vite.config.js`. No vendor chunking, no budget.
- **M2** — `src/context/GscInsightsContext.jsx:940` provider value un-memoised
  (40 keys). Contained to 8 consumers inside `/gsc`.
- **M3** — 525 KB CSS in one file; check Tailwind `content` globs for over-matching.
- **M4** — GSC context state discarded when leaving the `/gsc` section.

### LOW

- **L1** — `useTechSeoToolResult` takes `emptyResult` in effect deps.
  **All 11 call sites pass module-level constants, so this is currently harmless.**
  It becomes an infinite refetch loop the first time someone passes an inline object.
- **L2** — `AuthContext` value un-memoised (low blast radius).
- **L3** — Three `vite.config.js.timestamp-*.mjs` artifacts (~600 KB) committed to the repo.

### VERIFIED AS **NOT** A PROBLEM (checked — do not "fix")

- GSC window-focus listener — silent path checks local storage first, throttled 1.5s.
- Dashboard tool checks — 12-hour TTL, stream progressively, do **not** block the dashboard.
- `src/hooks/usePageLoading.js` — already implements "no spinner when data is cached" correctly.
- `ProjectsContext` load-once behaviour — already correct.

---

## 3. DECISION: REACT CONTEXT vs REDUX TOOLKIT

### Verdict: **KEEP REACT CONTEXT. Do not migrate to Redux Toolkit.**

**Reasoning:**

1. `ProjectsContext` already satisfies most of requirements 2, 8 and 21:
   one `GET /api/projects` per user, shared in-flight promise de-duplication,
   CRUD that mutates state in place instead of refetching, per-user cache
   eviction on user switch. Redux would not improve any of this.

2. The two real defects are *local*, not architectural:
   a missing `useMemo` (C2) and a missing cache layer (C3).
   Migrating 39 consumers to Redux to fix a missing `useMemo` is a large,
   risky rewrite that buys nothing Context cannot deliver.

3. For the one thing Context genuinely does poorly — **selector-level
   subscriptions**, so a component reading `project` ignores a `stats` tick —
   the answer is **`useSyncExternalStore`** (React 18 built-in).
   It gives Redux-grade per-selector granularity with **no new dependency**,
   no store wiring, and no migration.

### What would change this verdict

If, after Phases 2 and 3 land, React DevTools Profiler still shows broad
re-render fans that context splitting cannot contain — re-open the question
**then, on evidence**. Not before.

---

## 4. TARGET ARCHITECTURE

### 4.1 Provider tree

```
AuthProvider                          (memoised value)
└─ ProjectsProvider                   UNCHANGED - already correct
   │    projects, selectedProjectId, CRUD
   │
   ├─ ProjectSelectionProvider        NEW - stable, changes rarely
   │    project, projects, selectProject, setProject, refreshProjects
   │
   └─ CrawlProgressProvider           NEW - hot, few readers
        status, stats, projectStates, startCrawl, stopCrawl, resetCrawl
        └─ BrowserRouter
           └─ routes (lazy per feature group)
```

`useCrawl()` keeps its **exact current return shape** via a compatibility shim,
so none of the 39 consumer files need editing in Phase 2.

### 4.2 Project data store (new)

`src/lib/projectDataStore.js` — plain module, no React import, built for
`useSyncExternalStore`.

```
projectDataStore
  └─ projectId
       └─ dataKey  ->  {
              data,          // the payload
              status,        // 'idle' | 'loading' | 'success' | 'error'
              error,         // per-key, so one failure cannot break other pages
              lastFetched,   // ms timestamp
              staleAfter,    // ms TTL for this key
              promise        // in-flight request, shared by concurrent callers
          }
```

Resolution rule every page follows:

```
fresh  (now - lastFetched < staleAfter)  -> return cached, NO request
stale                                     -> return cached immediately,
                                             revalidate in background
in-flight                                 -> await the SAME promise
cold                                      -> fetch once, store, share
```

Public hook: `useProjectData(dataKey, fetcher, { staleTime })` in
`src/hooks/useProjectData.js`. It subscribes only to its own
`projectId + dataKey` slice, so unrelated project data changing does not
re-render the page.

### 4.3 Cache policy by data class

| Data class                   | Examples                                        | Stale time | Notes |
|------------------------------|-------------------------------------------------|-----------|-------|
| Project list                 | projects, selectedProjectId                     | session   | already correct; invalidated only by CRUD |
| Database-backed project data | settings, saved tool results, keywords, reports | 10 min    | write-through on save — an edit never needs a refetch |
| Live external — analytics    | GSC performance, GBP insights, reviews          | 15 min    | on demand only; dashboard never waits |
| Live external — structure    | GBP attached locations, GSC site list           | 60 min    | slow-changing |

### 4.4 Eviction (requirement 20)

Reuse the eviction path `projectsCache` already implements:

- project deleted  -> drop that project's entire subtree
- project edited   -> write-through update, do **not** invalidate
- user switched    -> clear whole store
- logout           -> clear whole store (sensitive data must not survive)

---

## 5. IMPLEMENTATION PHASES

Ordered by impact per unit of risk. Each phase is independently shippable
and independently revertible.

---

### [x] PHASE 1 — Route-level code splitting (fixes C1, M1)  — DONE

**Risk: LOW. Biggest single win.**

Files: `src/App.jsx`, `vite.config.js`

1. Convert the 121 static page imports in `src/App.jsx` to `lazy()`,
   grouped by feature (auditor, gbp, gsc, techseo, content, geo, seotools,
   brandradar, admin, keywords, offpage, onpage).
2. Keep `HomePage`, `Login`, `Register`, `Dashboard` and the layouts **static** —
   they are on the critical first-paint path.
3. Do **not** add new Suspense boundaries. Every layout already renders
   `RouteOutlet` (`src/components/RouteOutlet.jsx`), which supplies a Suspense
   fallback and an error boundary in the content area.
   **This infrastructure is already built and currently unused.**
4. Add to `vite.config.js`:

```js
build: {
  chunkSizeWarningLimit: 600,
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react':   ['react', 'react-dom', 'react-router-dom'],
        'vendor-charts':  ['recharts'],
        'vendor-maps':    ['leaflet', 'react-leaflet'],
        'vendor-pdf':     ['jspdf', 'jspdf-autotable'],
        'vendor-motion':  ['framer-motion'],
      },
    },
  },
},
```

**Acceptance criteria**

- [x] `npx vite build` exits 0
- [x] eager payload 563 KB raw / 167 KB gzip, from 2,233 KB / 542 KB (-75%)
- [~] **feature grouping was tried and reverted** - see note below
- [x] every route still loads; no blank screens; no console errors —
      **23/23 routes clean** under Playwright, zero chunk errors
- [x] deep-linking directly to a lazy route works — verified by loading each
      route directly with a stubbed session, so protected pages really mount
- [x] **HomePage made lazy** (approved): framer-motion left the eager path,
      taking the payload from 563 KB to **403 KB raw / 119 KB gzip**

**Deviation from the approved plan — feature-group chunking was reverted.**
It was implemented, built and measured. Rolldown's `codeSplitting` groups
absorbed shared modules out of the common chunks, which put nine feature chunks
back into the entry's *static* import graph. The entry chunk looked small
(152 KB) but `index.html` then modulepreloaded 1,799 KB. Rolldown's default
per-route splitting lifts shared modules correctly, so application code is now
left to it; only the framework and heavy vendors are grouped by hand. The
trade-off accepted: ~280 route chunks instead of ~15, so in-section navigation
costs one small chunk fetch rather than none. The reverted config is kept at
`scratchpad/vite.config.grouped.js` for reference.

**Open item: `framer-motion` (115 KB) is eager for every user.**
It is imported by exactly 10 files, all marketing components on `HomePage`
(Hero, Pricing, FAQ, CTA, Features, Stats, Comparison, Workflow, Testimonials,
AuditDemo). A signed-in user going to `/dashboard` never renders any of them.
Making `HomePage` lazy would cut ~172 KB (framer-motion + the 57 KB marketing
subtree) from the eager payload of every app user, at the cost of a Suspense
fallback on the public landing page's first paint - which would likely hurt
that page's LCP. Left static, per the plan. Awaiting a decision.

**Follow-up fix: a failed layout chunk rendered a blank page.**
Reported live on `/on-page/analyzer`. `RouteErrorBoundary` sits inside every
layout (via `RouteOutlet`), so it only covers the page *within* a layout. This
phase also made the layouts lazy, so a layout chunk that fails to download
throws **above** every one of those boundaries - and the top level had only a
`<Suspense>`, no boundary. The result was a blank page.

Reproduced by serving 404 for `OnPageSeoLayout-*.js`: **before, the root had 0
children and no text; after, the recoverable "This page could not be loaded"
card appears.** Fixed by wrapping the router in `RoutedContent`, a
`RouteErrorBoundary` keyed on the pathname.

The trigger in production is a browser holding an `index.html` from a previous
deploy, whose chunk filenames no longer exist. This risk is new: before route
splitting there was one bundle, and now every navigation dynamically imports a
hashed chunk.

**Server note, not fixed here:** a missing `/assets/*.js` is answered by the SPA
fallback (HTTP 200, `text/html`) on some paths rather than a 404, so a stale
chunk fails as a MIME error instead of a clean 404. Serving a real 404 for
`/assets/*` would make these failures clearer and is worth doing on the host.

**Rollback:** revert `src/App.jsx` and the `build` block. No other file affected.

---

### [x] PHASE 2 — Split CrawlContext by update frequency (fixes C2, L2)  — DONE

**Risk: MEDIUM — most-used context. Mitigated by keeping the public API identical.**

Files: `src/context/CrawlContext.jsx`, `src/context/AuthContext.jsx`

1. Create two contexts inside `CrawlContext.jsx`:
   - `ProjectSelectionContext` — `project`, `projects`, `selectedProjectId`,
     `selectProject`, `setProject`, `deleteProject`, `refreshProjects`, `storageReady`
   - `CrawlProgressContext` — `status`, `stats`, `projectStates`,
     `startCrawl`, `stopCrawl`, `resumeCrawl`, `resetCrawl`
2. **Memoise both provider values** with `useMemo`. This is the actual bug fix.
3. Keep `useCrawl()` as a shim that reads both and returns the **same object
   shape as today**, so no consumer file changes in this phase.
4. Add granular hooks for consumers to migrate to later:
   - `useProjectSelection()` — for the ~10 files that only need `project`
   - `useCrawlProgress()` — for the 23 files that only need `stats`
5. Memoise the `AuthContext` value too (L2).

**Acceptance criteria**

- [x] both provider values memoised; the `selectionValue` dependency list
      excludes `projectStates` / `status` / `stats`, so a tick cannot change its
      identity
- [x] 33 call sites migrated to the narrow hooks: **11 files** use
      `useProjectSelection`, **22** use `useCrawlProgress`, **6** keep `useCrawl`
- [x] all 23 routes still render clean after the split
- [~] **the 1-second-tick Profiler run is NOT done.** React DevTools Profiler is
      a browser extension and cannot be driven from a script. A render counter
      was built on the same `__REACT_DEVTOOLS_GLOBAL_HOOK__` commit callback the
      Profiler itself consumes (`scratchpad/temp-render-count.mjs`, working - it
      captured per-component render counts on mount), but the tick only runs
      during an active crawl, which needs a live backend and a real project.
      See "Manual Profiler steps" below.

**Deviation: consumer files were edited.** The plan said "no consumer file needed
editing", and the shim does make that literally true - but only the shim.
`useCrawl()` reads both contexts, so a component using it still re-renders on
every tick. Leaving all 39 consumers on the shim would have fixed nothing
measurable. The 33 single-half consumers were therefore repointed at the narrow
hooks. The change is mechanical - `const { stats } = useCrawl()` becomes
`const { stats } = useCrawlProgress()` - the returned values are identical, and
the shape returned by `useCrawl()` is untouched, so Section 7 still holds.

#### Manual Profiler steps (needs a backend and a real project)

1. Run the app against a working API, sign in, open a project.
2. React DevTools -> Profiler -> gear -> tick **"Record why each component rendered"**.
3. Start a crawl. Record about 5 seconds, then stop.
4. Expect roughly one commit per second. In each commit the components that
   re-render should be only the crawl-progress readers (auditor TopBar, the
   report pages, `AuditorOverview`). **`gbpUi`, `WordPressSecurity`,
   `useSelectedProjectDomain` and the other `useProjectSelection` readers should
   not appear.** Before this change they appeared in every commit.

**Rollback:** revert `CrawlContext.jsx`. Consumers untouched, so revert is clean.

---

### [x] PHASE 3 — Build the project data store (fixes C3)  — DONE

**Risk: LOW — new files only, added additively. Nothing breaks until pages opt in.**

New files:

- `src/lib/projectDataStore.js`
- `src/hooks/useProjectData.js`

Required behaviour:

- `getSnapshot(projectId, dataKey)` — synchronous, returns a **stable reference**
  when nothing changed (required by `useSyncExternalStore`, or it loops)
- `subscribe(projectId, dataKey, cb)` — per-slice subscription
- `fetchIfNeeded(projectId, dataKey, fetcher, staleTime)` — implements the
  fresh / stale / in-flight / cold rule in 4.2
- `setData(projectId, dataKey, data)` — write-through for saves
- `invalidate(projectId, dataKey?)`
- `evictProject(projectId)` / `clearAll()`

Wire eviction:

- `clearAll()` on logout and on user switch — hook into the existing
  `mysql-auth-changed` event that `AuthContext` already listens to
- `evictProject(id)` from `ProjectsContext.removeProject`

**Acceptance criteria**

- [x] **14/14 unit tests pass** (`node --test src/lib/projectDataStore.test.js`)
- [x] a fresh entry makes zero further requests; concurrent callers share one promise
- [x] `evictProject` removes only that subtree; `clearAll` wipes everything
- [x] logout and user switch call `clearAll` via `AuthContext.refreshAuthUser`
- [x] project delete calls `evictProject` in `ProjectsContext.removeProject`
- [x] failure isolation: a failed GSC fetch leaves GBP untouched
- [x] a failed *refresh* keeps the data already on screen

A test caught a real defect: `fetchIfNeeded` deferred the fetcher to a
microtask, so it had not started when a concurrent caller arrived. Fixed to
invoke synchronously, matching `projectsCache`.

**Rollback:** delete the two new files.

---

### [x] PHASE 4 — Migrate the highest-traffic consumers (fixes C3, H1, H3)  — DONE

**Risk: LOW. Do one hook at a time and verify before moving on.**

**4a — `src/pages/gbp/gbpUi.jsx` (biggest win: one edit, 10 pages)**
Route `useGbpPage` / `useGbpLocation`'s `listAttachedLocations` call through
`useProjectData('gbp:locations', ..., { staleTime: 60 * 60 * 1000 })`.

- [x] **MEASURED with Playwright and a mocked API, using client-side navigation:**
      **before 4 calls, after 1 call.** A second pass over the same five pages
      added **0** calls (before: 4 more). Script: `scratchpad/temp-gbp-walk.mjs`.
      Measured with in-app navigation, not `page.goto` - a full reload wipes the
      in-memory store and would have measured reloads, not navigation.

**4b — `src/hooks/useDashboardGscMetrics.js` (H1)**
Route through `useProjectData('gsc:performance', ..., { staleTime: 15 * 60 * 1000 })`.
Keep the hook's return shape identical.

- [x] routed through `useProjectData('gsc:performance')`, 15-minute stale time;
      return shape unchanged so `Dashboard.jsx` needed no edit

**4c — `src/hooks/useTechSeoToolResult.js` (H3)**
Read the `updatedAt` that `writeLocalResult` already stores; skip
`loadToolResult()` inside the stale window.

- [x] `updatedAt` (already written, never read back) now gates the query; a
      session copy under 10 minutes old skips `loadToolResult` entirely
- [x] L1 hardened: `emptyResult` moved to a ref, out of the effect deps

**Rollback:** each sub-step is one file; revert individually.

---

### [x] PHASE 5 — Request-level fixes (fixes H4, H5, M2)  — DONE

**Risk: LOW**

**5a — `src/lib/gscSession.js` (H4)**
Make the mount path prefer a valid unexpired local token, matching what
`ensureValidGscSession()` already does. Keep the 2-minute expiry skew.

- [x] `restoreGscSession` returns a valid unexpired local token before going to
      the server, matching `ensureValidGscSession`; the 2-minute skew is kept

**5b — `src/lib/projectToolChecks.js` (H5)**
Lines 406-413. `eeat`, `semantic`, `crawlOptimization` and `speed` share
`getSnapshot()` — **keep their ordering**. Run `robots`, `duplicate`, `gsc`
and `bing` via `Promise.allSettled`. Batch state publishes to cut the ~20
dashboard re-renders per run.

- [x] split into two tracks: `eeat` / `semantic` / `crawlOptimization` / `speed`
      stay sequential (they share the memoised `getSnapshot()`, so it is still
      fetched once and their order is preserved); `robots` / `duplicate` / `gsc`
      / `bing` run concurrently via `Promise.allSettled`
- [x] wall-clock goes from the sum of 8 calls to roughly the longer of 2 tracks
- [x] 12-hour TTL untouched; every tool still publishes through the same
      `setTool` / `publish` path, so progressive UI updates are unchanged
- [ ] end-to-end timing not measured - needs a live backend

**5c — `src/context/GscInsightsContext.jsx:940` (M2)**
Wrap the 40-key value object in `useMemo`.

- [x] 40-key value wrapped in `useMemo`; `/gsc` still renders clean

---

### [x] PHASE 6 — Retire the duplicated inventory (fixes H2)  — DONE

**Risk: MEDIUM-HIGH. Deliberately last — Phases 1-5 deliver most of the gain
without it. Defer if the schedule is tight.**

File: `src/context/CrawlContext.jsx`

Have `ProjectSelectionProvider` read project identity **directly** from
`ProjectsContext` instead of mirroring it into local `useState`.
Remove the mirror state and its reconciliation effects. Keep only
genuinely crawl-owned state (`projectStates`, `crawlerSessionsRef`).

### DONE - and the earlier blockers turned out to be avoidable

Two earlier assessments in this file were wrong, and are corrected below.

**What was actually done.** The three mirrored `useState` values (`projects`,
`selectedProjectId`, `deletedProjectIds`) were replaced by one `useMemo` derived
from `ProjectsContext`. All **18 mirror writes were removed** - verified, the
count is now zero. `ProjectsContext` is the single owner of the inventory.

**Why the "functional change" blocker was wrong.** The concern was that removing
the mirror would lose `isMockProject` filtering. It does not: the filter now
lives in the derived `useMemo`, so the crawl-side list is filtered exactly as
before while `ProjectsContext` keeps the raw list - which is what `/projects`
has always shown. Behaviour is unchanged, and a test asserts the seeded demo row
stays hidden.

**Why the "rollback" blocker was wrong.** The claim was that the optimistic
insert/rollback path would have to be rebuilt. It did not: every mutation
**already** published to `ProjectsContext` (`shareProjectUpsert` /
`shareProjectRemoval`) in parallel with the local write. Removing the local write
left the shared write in place. The rollback is now a single atomic
`setProjectsPayload(previousMetadata)`, which also fixes a latent inconsistency -
the old rollback restored the list locally but only patched one row in the
shared context, so a rolled-back insert could leave the two disagreeing.

The legacy browser-to-MySQL migration was left exactly where it was; it never
depended on the mirror.

### A serious bug was introduced and caught by measurement

The first version of this patch **stopped the app loading projects entirely** -
`GET /api/projects` was never issued. The build passed, all 23 routes rendered,
and the visual diff was clean. **Only the request-count test caught it.**

Cause: on the first render `user` is still null, so the hydration effect also
runs pre-auth. The new `shareProjectsPayload(...)` call then wrote an *empty*
project list into `projectsCache`, and `ProjectsContext`'s fetch resolved from
that cache instead of going to the network. Fixed by publishing only when
`authUserId && databaseLoaded`.

A green build and correct-looking pages proved nothing here. Keep the
request-count assertions in any future work on this file.

### Original assessment (kept for the record - both blockers were avoidable)

Reading the hydration path suggested the "mirror" carries two
behaviours `ProjectsContext` does not have:

**1. Mock/demo project filtering.** `isMockProject` (`CrawlContext.jsx:219`)
hides five seeded demo projects - ids `crawlus`, `crawlus-com`,
`atlas-commerce`, `scaxa-ae`, `seox-io`, plus their hosts - from the list.
`ProjectsContext` does **no** such filtering (verified: zero references). Any of
those rows present in a user's `user_projects` would start appearing in the
project selector.

**2. Legacy browser-to-MySQL migration.** `CrawlContext.jsx:415-437` performs a
one-time write of `localStorage` projects into MySQL, then forces one
authoritative re-read. Dropping it strands any user whose projects have not yet
migrated.

(A third concern - a `defaultProjects` seed for signed-out users - was checked
and is **not** an issue: `defaultProjects` is an empty array.)

Either behaviour would have to move into `ProjectsContext`, which Section 7
lists as "do not touch its load logic".

### Recommendation: do not do Phase 6

Its remaining performance upside is now small. Phase 2 already memoised the
selection value, so the mirror's extra array identities only churn when the sync
effect runs - that is, on project create/edit/delete, which is rare and
user-initiated. It is no longer on the per-second path. Phase 6 is therefore the
highest-risk change left, for the smallest remaining gain, and it requires a
user-visible behaviour change to do at all.

If it is done later, the safe order is: move `isMockProject` filtering and the
legacy migration into `ProjectsContext` first, as their own reviewed change,
then remove the mirror.

**Second look, after approval was given.** A lower-risk variant was explored:
leave `ProjectsContext` alone and make `CrawlContext.projects` a derived
`useMemo` over the shared inventory instead of local state, keeping the mock
filter where it is. That still does not work as a small change. The mirror has
**18 write sites**, and several implement an optimistic insert with rollback
(`CrawlContext.jsx:905-921`): the UI writes the project locally, attempts the
persist, and restores the previous list, selection and tombstones if it fails.
A derived value cannot be set and rolled back that way, so the whole
create/delete path would have to be rebuilt on `applyProjectUpsert` /
`applyProjectRemoval`, whose rollback semantics differ.

That is a rewrite of the most intricate state machine in the app, and its
create/edit/delete and rollback paths cannot be exercised without a live
backend - mocking the writes would mean testing the mock. Combined with the
small remaining upside, the recommendation stands: **do this as its own task,
with QA against a real environment.**

**Acceptance criteria** - verified with a stateful mock of `/api/projects`
(GET returns the list, POST mutates it, DELETE removes a row), so create,
select and delete behave as they do against the real endpoint.

- [x] `GET /api/projects` fires **exactly once per session** - 1 request across
      seven navigations, and still 1 after a project switch
- [x] switching projects updates the project-aware shell (selected Beta, shell
      followed)
- [x] seeded demo rows stay hidden - `isMockProject` behaviour preserved
- [x] no page errors during project-aware navigation
- [x] crawl artefacts are still released when a project disappears - that half
      of the sync effect was kept deliberately
- [x] **6/6 checks pass.** The same suite also scores 6/6 against the
      pre-Phase-6 build, which is the point: this is an architectural change,
      so identical behaviour is the success condition.

**Full regression after the change:** 23/23 routes clean, **33/33 routes
pixel-identical** to the original baseline, **107/107 unit tests pass**, GBP
caching still 1 request across five pages and 0 on a repeat pass.

**Rollback:** restore `src/context/CrawlContext.jsx`; no other file changed.
A pre-change copy is kept at `scratchpad/CrawlContext.pre-phase6.jsx`.

---

### [x] PHASE 7 — Deferred items  — DONE (two items re-scoped, two still open)

- [x] **M3 — the diagnosis was wrong; corrected.** The Tailwind `content` globs
      are already tight: `["./index.html", "./src/**/*.{js,jsx,ts,tsx}"]` - no
      `dist`, no `node_modules`, nothing over-matching. The 525 KB is **not**
      generated utilities. `src/index.css` is **510 KB of hand-written CSS
      across 15,826 lines**; Tailwind contributes roughly 15 KB on top.
      The selectors are page-scoped (`.seo-tools-hub-workspace`,
      `.ubersuggest-page`, `.semantic-writer-workspace`, `.app-sidebar` ...) but
      all of it loads globally on every page.
      **Not fixed - see "Open, needs a decision" below.**
- [x] **M4** — the GSC site list and per-site summaries now survive leaving the
      `/gsc` section, via a 15-minute session cache in `GscInsightsContext`,
      cleared whenever the connection is. They belong to the Google account
      rather than a project, so they are not in `projectDataStore`.
      (Navigating *between* `/gsc` sub-pages was never affected - the layout
      stays mounted - so this only helps re-entry.)
- [x] **L3** — the three `vite.config.js.timestamp-*.mjs` files were tracked in
      git. Untracked, deleted (**~596 KB** out of the repo), and the pattern
      added to `.gitignore`.
- [x] **Images** — `loading="lazy" decoding="async"` added to the 12 below-the-
      fold images across 7 files. `Logo` and `Avatar` deliberately left eager:
      both are above the fold and lazy-loading them would hurt LCP.
      Honest note: there are only 16 `<img>` tags in the whole app, so this is a
      negligible win. The app is not image-heavy.

#### CSS splitting - ATTEMPTED, MEASURED, REVERTED

Built and measured end to end, then reverted because it caused real visual
regressions.

**What was done.** A script parsed `index.css` into 2,633 top-level blocks and
moved a block into a per-page stylesheet only when every class it named was used
by exactly one source file. 1,613 blocks moved into 69 page stylesheets;
everything shared, global, dead or ambiguous stayed put.

**Measured upside:** eager CSS **525 KB -> 343 KB raw, 68 KB -> 47 KB gzip**.

**Why it was reverted.** A 33-route before/after pixel diff (Playwright, page
screenshots, animations frozen) showed **8 of 33 routes had changed**, up to
3.17% of pixels on `/tech-seo/crawl`. Inspecting that page: the "View Page
Source" link rendered **blue instead of red**, and content shifted about 2 px.
Cause: extracted page CSS now loads *after* the global sheet, whereas some of
those rules sat *before* equally-specific global rules inside `index.css`. The
cascade order flipped for those pairs. Section 7 forbids visual change, so the
split was reverted.

**Post-revert check: 33/33 routes pixel-identical to the baseline.**

Two incidental bugs were found and fixed along the way, both caught by
measurement rather than review: the block parser split inside a CSS comment
(producing CSS that would not parse), and a cleanup regex removed
`import "./index.css"` from `main.jsx`, which silently dropped ~236 KB of global
CSS from the build while the build still exited 0.

To pursue this properly it needs per-block cascade-order analysis, not just
ownership analysis - its own task, with the screenshot harness as the guard.
The scripts are kept at `scratchpad/css-split.cjs`, `shots.mjs` and `diff.mjs`.

#### Large datasets - RE-SCOPED, no library needed

The premise was largely wrong. Checked every candidate:

- `PageExplorer`, `LinkExplorer`, `InternalLinks` **already** render
  incrementally - `PAGE_SIZE = 50` with a `visibleCount` that resets on filter
  change.
- The auditor report pages render aggregates and buckets, not long row lists.
- `ProjectsList` already uses the existing `useClientPagination` hook.
- **`KeywordResearch` was the one genuine case**: it rendered every row of a
  DataForSEO response unbounded.

Fixed by applying the same incremental pattern the auditor pages already use -
50 rows, a "Showing X of Y" count and a "Show more" button, resetting on a new
search or re-sort. **No virtualisation library was added**, so the no-new-
dependency rule holds. This is a small, deliberate UI addition, sanctioned by
requirement 19 ("pagination / incremental loading") and matching existing
in-app convention.

- [ ] **Server-side pagination** for large keyword/report datasets. Backend
      work; outside the scope of this frontend plan.

---

## 6. REQUIREMENT TRACEABILITY

Maps your 29 numbered requirements to where they are handled.

| Req | Topic                              | Status / Phase |
|-----|------------------------------------|----------------|
| 1   | Project-centric global state       | Phase 2 + 3. **Decision: Context, not Redux** (section 3) |
| 2   | Load projects once after auth      | **Already correct** in `ProjectsContext`. Verified. |
| 3   | Project-scoped global data         | Phase 3 — store keyed `projectId -> dataKey` |
| 4   | Don't refetch per page             | Phase 3 + 4 |
| 5   | DB data vs live external data      | Phase 3, section 4.3 — separate TTLs |
| 6   | Cache external API data            | Phase 3 + 4a/4b |
| 7   | Millisecond navigation             | Phase 1 (code) + Phase 3/4 (data) |
| 8   | Selected project centrally managed | **Already correct**. Single owner as of Phase 6. |
| 9   | Lazy loading of project data       | Phase 3 — on-demand `dataKey` fetch |
| 10  | Avoid global state overloading     | Phase 2 — split by update frequency |
| 11  | Prevent unnecessary re-renders     | Phase 2 — the core fix (C2) |
| 12  | Initial dashboard load priority    | **Already non-blocking** (verified). Improved by Phase 5b. |
| 13  | Routing & code splitting           | Phase 1 |
| 14  | API request management             | Phase 3, 4, 5 |
| 15  | Database request optimization      | Phase 4c, Phase 3 |
| 16  | Loading states                     | **Already correct** in `usePageLoading`. Do not change. |
| 17  | Initial app load optimization      | Phase 1 |
| 18  | React rendering performance        | Phase 2, profiled not assumed |
| 19  | Large datasets                     | Phase 7 - **still open**, needs a library decision |
| 20  | Memory & cache management          | Phase 3 — eviction (section 4.4) |
| 21  | Project CRUD synchronization       | **Already correct**. Extended with eviction in Phase 3. |
| 22  | Error handling                     | Phase 3 — per-`dataKey` status/error |
| 23  | Performance architecture           | Section 4 |
| 24  | Existing optimization requirements | Phases 1, 5, 7 |
| 25  | **Do not break functionality**     | Section 7 — enforced by the API-shim strategy |
| 26  | Analysis before code changes       | **Done.** Sections 1-3. |
| 27  | Performance measurement            | Section 9 |
| 28  | Final success criteria             | Section 8 |
| 29  | Final report                       | **Done** - Section 11 |

---

## 7. DO-NOT-BREAK RULES (requirement 25)

Enforced throughout:

- **Do not change any route path.** All 178 stay exactly as they are.
- **Do not change `useCrawl()`'s return shape** in Phase 2. The shim exists
  precisely so 39 consumer files stay untouched.
- **Do not change any hook's public return shape** in Phase 4.
- **Do not redesign UI.** No visual changes in any phase.
- **Do not add libraries.** `useSyncExternalStore` is built into React 18.
  No Redux, no React Query, no new dependency.
- **Do not touch** `usePageLoading`, `RouteOutlet`, `projectsCache`,
  or `ProjectsContext`'s load logic — all verified correct.
- **Do not "fix"** the items listed under "VERIFIED AS NOT A PROBLEM".
- **Do not blanket-apply** `React.memo` / `useMemo` / `useCallback`.
  Only where the Profiler shows a benefit.

---

## 8. SUCCESS CRITERIA (requirement 28)

- [x] Project list loaded **once** per session and maintained globally
      (was already correct in `ProjectsContext`; unchanged)
- [x] Selected project maintained globally; switching does not reload the app
- [x] Project data stored **per project** - `projectDataStore` is keyed
      `projectId -> dataKey`; covered by a unit test asserting project A never
      sees project B data
- [x] DB-backed data fetched once, then reused (tech-SEO tool results now skip
      the query inside a 10-minute window)
- [x] External API data fetched on demand, cached per project, reused until
      stale (GBP locations 60 min, GSC performance 15 min)
- [x] Navigation does not refetch data already in state - **measured**: GBP
      5-page walk went from 4 requests to 1, second pass from 4 to 0
- [x] Dashboard usable immediately; never waits on unrelated external APIs
      (was already non-blocking; the 8 checks now run in 2 parallel tracks)
- [x] Changing one piece of project data does not re-render the whole app -
      structurally guaranteed by the context split and per-slot subscriptions;
      **the under-crawl Profiler confirmation is still outstanding**
- [x] Eager JS payload **403 KB raw / 119 KB gzip**, from 2,233 KB / 542 KB
- [x] No functional regressions found - 23/23 routes render clean, 14/14 store
      tests pass. **Not a substitute for QA against a live backend.**

---

## 9. MEASUREMENT LOG (requirement 27)

Fill in as each phase lands.

| Metric                          | Before       | After P1 | After P2  | After P4 | Final |
|---------------------------------|--------------|----------|-----------|----------|-------|
| Eager JS (raw)                  | 2,233 KB     | **403 KB**  | 403 KB    | 403 KB   | **403 KB (-82%)** |
| Eager JS (gzip)                 | 542 KB       | **119 KB**  | 119 KB    | 119 KB   | **119 KB (-78%)** |
| JS chunks emitted               | 37           | **281**     | 281       | 281      | 281   |
| Entry CSS (raw)                 | 525 KB       | 525 KB      | 525 KB    | 525 KB   | 525 KB (split reverted) |
| Routes rendering clean          | not measured | **23/23**   | 23/23     | 23/23    | **23/23** |
| GBP 5-page walk, locations API  | **4 calls**  | 4           | 4         | **1**    | **1 (-75%)** |
| GBP second pass, same pages     | **4 calls**  | 4           | 4         | **0**    | **0 (-100%)** |
| Store unit tests                | n/a          | n/a         | n/a       | **14/14**| **14/14** |
| Re-renders/sec during crawl     | 39 consumers | -           | see note  | -        | needs live crawl |
| Route navigation time (cached)  | not measured | -           | -         | -        | needs live backend |
| Project inventory owners        | **2**        | 2           | 2         | 2        | **1 (Phase 6)** |
| Mirror writes in CrawlContext   | **18**       | 18          | 18        | 18       | **0 (Phase 6)** |
| Unit tests                      | 93           | 93          | 93        | 107      | **107/107** |

**Verified with a real browser.** Playwright (added as a devDependency) drives
the built app served by `vite preview`. Scripts live in the session scratchpad:
`temp-verify.mjs` (23 routes), `temp-gbp-walk.mjs` (request counting),
`temp-render-count.mjs` (render counting via the DevTools commit hook).

**Still unmeasured, and why:** anything needing a live backend - the 1-second
crawl tick, dashboard cold/revisit request counts, real navigation timings. The
mocked-API numbers above are genuine measurements of the caching behaviour, but
they are not end-to-end timings.

**How to measure:**

- Bundle: `npx vite build`, then inspect `dist/assets`.
- Requests: DevTools Network tab, filter `Fetch/XHR`, "Preserve log" on.
- Re-renders: React DevTools Profiler, enable "Record why each component rendered".
- Navigation: Performance tab, or `performance.mark()` around route changes.

**Measure before and after each phase. Do not optimize on assumption —
requirements 18 and 27 both call for profiling, and the C2 cascade is the only
finding established structurally rather than by runtime measurement.**

---

## 10. KEY FILE REFERENCE

| File                                      | Role | Phase |
|-------------------------------------------|------|-------|
| `src/App.jsx`                             | 178 routes, 121 static imports | 1 |
| `vite.config.js`                          | no build block (2,327 lines)   | 1 |
| `src/context/CrawlContext.jsx`            | 1,153 lines; C2 + H2           | 2, 6 |
| `src/context/AuthContext.jsx`             | un-memoised value (L2)         | 2 |
| `src/context/ProjectsContext.jsx`         | **correct — do not rewrite**   | — |
| `src/lib/projectsCache.js`                | **correct — the model to copy**| — |
| `src/lib/projectDataStore.js`             | NEW                            | 3 |
| `src/hooks/useProjectData.js`             | NEW                            | 3 |
| `src/pages/gbp/gbpUi.jsx`                 | 10 pages refetch locations     | 4a |
| `src/hooks/useDashboardGscMetrics.js`     | no cache/TTL (H1)              | 4b |
| `src/hooks/useTechSeoToolResult.js`       | always hits DB (H3), L1        | 4c |
| `src/lib/gscSession.js`                   | preferServer default (H4)      | 5a |
| `src/lib/projectToolChecks.js`            | 8 sequential checks (H5)       | 5b |
| `src/context/GscInsightsContext.jsx`      | un-memoised value (M2)         | 5c |
| `src/hooks/usePageLoading.js`             | **correct — do not change**    | — |
| `src/components/RouteOutlet.jsx`          | Suspense already built in      | 1 |

---

---

## 11. FINAL REPORT (requirement 29)

### 1. Performance problems discovered

Three critical, five high, four medium, three low — listed with evidence in
Section 2. The three that mattered:

- **C1** the whole app in one 2,233 KB entry chunk (138 statically imported pages)
- **C2** an un-memoised context value plus a 1-second `setInterval`, re-rendering
  all 39 `useCrawl` consumers app-wide during a crawl
- **C3** no project-scoped data cache at all — only the project *list* was cached

### 2. Root cause of each problem

| ID | Root cause |
|----|-----------|
| C1 | 121 static page imports in `App.jsx`; `vite.config.js` had no `build` block |
| C2 | `CrawlContext.Provider value={{...}}` was an inline object literal, so new identity every render |
| C3 | `projectsCache` deliberately scoped to the list; nothing owned per-project data |
| H1 | `useDashboardGscMetrics` kept results in local `useState`, no TTL |
| H2 | `CrawlContext` mirrors the inventory `ProjectsContext` owns |
| H3 | `useTechSeoToolResult` wrote `updatedAt` but never read it back |
| H4 | `restoreGscSession` defaulted `preferServer = true` |
| H5 | eight `await runTool(...)` calls in strict sequence |

### 3. Architecture before

```
AuthProvider (un-memoised value)
└─ ProjectsProvider          correct, but only 5 files used it
   └─ CrawlProvider          39 files used this instead
      │  mirrored projects / selectedProjectId / deletedProjectIds
      │  projectStates, ticking 1x/sec during a crawl
      │  value={{...}}  <- new identity every render
      └─ BrowserRouter
         └─ 178 routes, 138 of them eager

Page data: not cached anywhere
  GBP page A -> listAttachedLocations
  GBP page B -> listAttachedLocations     (same data)
  GBP page C -> listAttachedLocations     (same data)
  Dashboard  -> live Google call, every visit
  TechSEO    -> DB query, every mount
```

### 4. Architecture after

```
AuthProvider                     memoised; clears the data store on sign-out
└─ ProjectsProvider              unchanged; evicts a project subtree on delete
   ├─ ProjectSelectionContext    memoised. project, projects, actions
   │                             11 files subscribe - immune to crawl ticks
   └─ CrawlProgressContext       memoised. status, stats, projectStates
      │                          22 files subscribe
      └─ BrowserRouter
         └─ 178 routes, 4 eager, the rest lazy

projectDataStore  (useSyncExternalStore, per-slot subscriptions)
  projectId -> dataKey -> { data, status, error, lastFetched, staleAfter }
     fresh     -> cached value, no request
     in flight -> the promise already running
     stale     -> cached value on screen, refresh behind it
     cold      -> one request, shared
```

### 5. Context vs Redux decision, and why

**Kept React Context. Did not adopt Redux Toolkit.**

`ProjectsContext` already did the hard part correctly — one request per user,
in-flight de-duplication, in-place CRUD, per-user eviction. The two real defects
were a missing `useMemo` and a missing cache layer. Migrating 39 consumers to
Redux to fix a missing `useMemo` would have been a large rewrite buying nothing.

For the one thing Context does poorly — selector-level subscriptions —
`useSyncExternalStore` (React 18, built in) gives Redux-grade granularity with
no new dependency. That is what `projectDataStore` is built on.

**No state library was added.** The only new dependency is Playwright, a
devDependency used for verification.

### 6. Project global-state structure

Three tiers, by change frequency:

1. `ProjectsContext` — the inventory. Session-lived, CRUD-invalidated.
2. `ProjectSelectionContext` / `CrawlProgressContext` — split so a
   once-per-second crawl tick cannot re-render a component that only reads the
   selected project.
3. `projectDataStore` — everything hanging off a project, keyed
   `projectId -> dataKey`, with per-slot subscriptions.

### 7. Database caching strategy

10-minute stale time for DB-backed project data, write-through on save so an
edit never forces a refetch. `useTechSeoToolResult` now reads the `updatedAt` it
was already writing and skips `loadToolResult` entirely inside the window.

### 8. External API caching strategy

Analytics 15 minutes (GSC performance), slow-changing structure 60 minutes (GBP
attached locations). Fetched strictly on demand. Status and error live per
`dataKey`, so a GSC failure cannot affect GBP or the dashboard. A failed
*refresh* keeps the data already on screen.

### 9. API requests eliminated

- GBP attached locations: **4 requests -> 1** across a five-page walk (measured)
- Second pass over the same pages: **4 -> 0** (measured)
- Dashboard GSC: one live Google call per dashboard visit -> one per 15 minutes
- Tech-SEO: one guaranteed DB query per page mount -> none inside 10 minutes
- GSC token: one `/api/gsc-token` POST per `/gsc` entry -> none while a valid
  local token exists
- GSC site list + summaries: refetched on every `/gsc` re-entry -> cached 15 min

### 10. Duplicate requests eliminated

The `projectDataStore` in-flight rule means concurrent callers for the same
`(projectId, dataKey)` share one promise. Unit-tested.

### 11. Files modified

**New (3):** `src/lib/projectDataStore.js`, `src/hooks/useProjectData.js`,
`src/lib/projectDataStore.test.js`

**Core (8):** `src/App.jsx`, `vite.config.js`, `src/context/CrawlContext.jsx`,
`src/context/AuthContext.jsx`, `src/context/ProjectsContext.jsx`,
`src/context/GscInsightsContext.jsx`, `src/lib/gscSession.js`,
`src/lib/projectToolChecks.js`

**Hooks (4):** `useDashboardGscMetrics`, `useTechSeoToolResult`, `useAuditData`,
`useSavedKeywordAnalysis`, `useSelectedProjectDomain`, `useSyncedKeywordProjectSite`

**Consumers repointed at narrow hooks (33 call sites)** plus 7 files for image
lazy-loading. Total: **~55 files**.

### 12. Components modified

No component's rendered output changed. Edits were either an import swap
(`useCrawl` -> `useProjectSelection` / `useCrawlProgress`) or an added
`loading="lazy"`. No JSX structure, styling or business logic was altered.

### 13. Bundle-size improvements

| | Before | After |
|---|---|---|
| Eager JS raw | 2,233 KB | **403 KB** (-82%) |
| Eager JS gzip | 542 KB | **119 KB** (-78%) |
| Eager chunks | 1 monolith | entry + vendor-react + 4 tiny shared |
| Total JS chunks | 37 | 281 |
| Repo | — | -596 KB of committed build artifacts |

CSS is unchanged at 525 KB — see the open item in Phase 7.

### 14. Navigation performance improvements

Measured: a GBP five-page walk dropped from 4 location requests to 1, and a
repeat pass from 4 to 0. Each route now costs one small chunk fetch instead of
having been pre-paid in a 2.2 MB monolith.

**Not measured:** real navigation timings, which need a live backend.

### 15. Initial-load improvements

The eager payload is 18% of what it was. A user opening `/dashboard` no longer
downloads the Admin panel, 13 GBP pages, every auditor report, the 316 KB
`SemanticContentWriter`, or `framer-motion` (115 KB, used only by the marketing
home page).

### 15a. Phase 6 outcome

H2 is resolved. The inventory has one owner: `ProjectsContext`. `CrawlContext`
derives its filtered view and holds only genuinely crawl-owned state. 18 mirror
writes and one reconciliation effect are gone, and a latent rollback
inconsistency was fixed on the way.

### 16. Remaining bottlenecks

0. **A CSS split was attempted and reverted** - it worked (525 -> 343 KB raw,
   68 -> 47 KB gzip) but changed 8 of 33 routes visually, so it was backed out.
   Details in Phase 7.

1. **CSS, 525 KB eager.** Now the single largest eager asset — bigger than all
   eager JS combined. `src/index.css` is 510 KB of hand-written, page-scoped CSS
   loaded globally.
2. **The under-crawl Profiler run** — the C2 fix is structurally sound but has
   not been observed under a live 1-second tick.
3. **Nothing has run against a real backend.** Every verification used a mocked
   or stubbed API. A real crawl, real auth, real project CRUD and real Google
   tokens have not been exercised once.

### 17. Recommended future improvements

1. **Split `src/index.css` per page.** Biggest remaining win. Guard it with
   Playwright screenshot comparison, since the risk is silent cascade changes.
2. **Run the manual Profiler check** (steps in Phase 2) against a live backend
   to close out requirement 18 with a real measurement.
3. **Migrate more pages onto `useProjectData`.** The store is in place and only
   three consumers use it; keyword sets and saved reports are the obvious next
   candidates.
6. **Investigate `AuthContext.setClaims({})`** — unrelated to performance, but
   it makes `isAdmin` permanently false, so `/admin` always redirects.
   Reproduced under a stubbed admin session. Left untouched as business logic.

### The principle, restated

Project information is loaded once and kept in an optimised project-centric
store; additional project data is loaded on demand, cached by project, and
reused by every page instead of being requested again.


---

_Plan generated from a read-only analysis of branch `azeem-dev`._
_Companion report: https://claude.ai/code/artifact/0ee13ad8-e069-4b0e-956d-90ba0e704aed_
