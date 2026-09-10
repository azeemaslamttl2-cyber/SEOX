import test from "node:test";
import assert from "node:assert/strict";
import {
  clearProjectsCache,
  fetchProjectsCached,
  getCachedProjects,
  setProjectsCache,
} from "../src/lib/projectsCache.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("concurrent readers share a single in-flight request", async () => {
  clearProjectsCache();
  let calls = 0;
  const gate = deferred();
  const fetcher = () => {
    calls += 1;
    return gate.promise;
  };

  // Three components ask for projects while the request is still running.
  const a = fetchProjectsCached("user-1", fetcher);
  const b = fetchProjectsCached("user-1", fetcher);
  const c = fetchProjectsCached("user-1", fetcher);

  gate.resolve({ projects: [{ id: "p1" }], selectedProjectId: "p1", deletedProjectIds: [] });
  const [ra, rb, rc] = await Promise.all([a, b, c]);

  assert.equal(calls, 1);
  assert.deepEqual(ra.projects, [{ id: "p1" }]);
  assert.equal(ra, rb);
  assert.equal(rb, rc);
});

test("a cached payload is reused instead of refetching", async () => {
  clearProjectsCache();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return { projects: [{ id: "p1" }], selectedProjectId: "p1", deletedProjectIds: [] };
  };

  await fetchProjectsCached("user-1", fetcher);
  await fetchProjectsCached("user-1", fetcher);
  await fetchProjectsCached("user-1", fetcher);

  assert.equal(calls, 1);
});

test("force bypasses the cached payload but still shares one forced request", async () => {
  clearProjectsCache();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return { projects: [{ id: `p${calls}` }], selectedProjectId: null, deletedProjectIds: [] };
  };

  await fetchProjectsCached("user-1", fetcher);
  assert.equal(calls, 1);

  const [first, second] = await Promise.all([
    fetchProjectsCached("user-1", fetcher, { force: true }),
    fetchProjectsCached("user-1", fetcher, { force: true }),
  ]);

  assert.equal(calls, 2);
  assert.deepEqual(first.projects, [{ id: "p2" }]);
  assert.equal(first, second);
});

test("a failed load is not cached as an empty project list", async () => {
  clearProjectsCache();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    if (calls === 1) throw new Error("network down");
    return { projects: [{ id: "p1" }], selectedProjectId: "p1", deletedProjectIds: [] };
  };

  await assert.rejects(fetchProjectsCached("user-1", fetcher), /network down/);
  assert.equal(getCachedProjects("user-1"), null);

  const retry = await fetchProjectsCached("user-1", fetcher);
  assert.equal(calls, 2);
  assert.deepEqual(retry.projects, [{ id: "p1" }]);
});

test("cached entries are scoped per user and cleared on sign-out", async () => {
  clearProjectsCache();
  const fetcher = (uid) => Promise.resolve({ projects: [{ id: `${uid}-p1` }] });

  const one = await fetchProjectsCached("user-1", fetcher);
  const two = await fetchProjectsCached("user-2", fetcher);
  assert.deepEqual(one.projects, [{ id: "user-1-p1" }]);
  assert.deepEqual(two.projects, [{ id: "user-2-p1" }]);

  clearProjectsCache("user-1");
  assert.equal(getCachedProjects("user-1"), null);
  assert.deepEqual(getCachedProjects("user-2").projects, [{ id: "user-2-p1" }]);

  clearProjectsCache();
  assert.equal(getCachedProjects("user-2"), null);
});

test("a written-through mutation is served without another request", async () => {
  clearProjectsCache();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return { projects: [{ id: "p1" }], selectedProjectId: "p1", deletedProjectIds: [] };
  };

  await fetchProjectsCached("user-1", fetcher);
  setProjectsCache("user-1", {
    projects: [{ id: "p1" }, { id: "p2" }],
    selectedProjectId: "p2",
    deletedProjectIds: [],
  });

  const next = await fetchProjectsCached("user-1", fetcher);
  assert.equal(calls, 1);
  assert.deepEqual(
    next.projects.map((item) => item.id),
    ["p1", "p2"]
  );
  assert.equal(next.selectedProjectId, "p2");
});

test("no user means no request", async () => {
  clearProjectsCache();
  let calls = 0;
  const result = await fetchProjectsCached(null, async () => {
    calls += 1;
    return { projects: [{ id: "p1" }] };
  });

  assert.equal(calls, 0);
  assert.deepEqual(result.projects, []);
});
