import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  clearAll,
  debugStats,
  evictProject,
  fetchIfNeeded,
  getSnapshot,
  invalidate,
  isFresh,
  setData,
  subscribe,
} from './projectDataStore.js';

const MINUTE = 60 * 1000;

/** Counts how many times it is actually called, so "no request" is testable. */
function countingFetcher(value = 'payload') {
  const fn = () => {
    fn.calls += 1;
    return Promise.resolve(value);
  };
  fn.calls = 0;
  return fn;
}

describe('projectDataStore', () => {
  beforeEach(() => clearAll());

  it('fetches once, then serves the cached value with no further requests', async () => {
    const fetcher = countingFetcher('locations');

    await fetchIfNeeded('p1', 'gbp:locations', fetcher, { staleTime: MINUTE });
    await fetchIfNeeded('p1', 'gbp:locations', fetcher, { staleTime: MINUTE });
    await fetchIfNeeded('p1', 'gbp:locations', fetcher, { staleTime: MINUTE });

    assert.equal(fetcher.calls, 1, 'a fresh entry must not issue another request');
    assert.equal(getSnapshot('p1', 'gbp:locations').data, 'locations');
    assert.equal(getSnapshot('p1', 'gbp:locations').status, 'success');
  });

  it('shares one in-flight promise between concurrent callers', async () => {
    let resolve;
    let calls = 0;
    const fetcher = () => {
      calls += 1;
      return new Promise((r) => {
        resolve = r;
      });
    };

    const a = fetchIfNeeded('p1', 'slow', fetcher, { staleTime: MINUTE });
    const b = fetchIfNeeded('p1', 'slow', fetcher, { staleTime: MINUTE });
    const c = fetchIfNeeded('p1', 'slow', fetcher, { staleTime: MINUTE });

    assert.equal(calls, 1, 'concurrent callers must join the running request');
    assert.equal(a, b);
    assert.equal(b, c);

    resolve('done');
    assert.deepEqual(await Promise.all([a, b, c]), ['done', 'done', 'done']);
  });

  it('refetches once the entry is stale', async () => {
    const fetcher = countingFetcher();
    await fetchIfNeeded('p1', 'k', fetcher, { staleTime: 0 });
    await fetchIfNeeded('p1', 'k', fetcher, { staleTime: 0 });
    assert.equal(fetcher.calls, 2);
  });

  it('keeps data on screen while a refresh runs, and after one fails', async () => {
    await fetchIfNeeded('p1', 'k', countingFetcher('first'), { staleTime: MINUTE });

    const failing = () => Promise.reject(new Error('network down'));
    await assert.rejects(fetchIfNeeded('p1', 'k', failing, { staleTime: MINUTE, force: true }));

    const snap = getSnapshot('p1', 'k');
    assert.equal(snap.data, 'first', 'a failed refresh must not discard good data');
    assert.equal(snap.status, 'success');
    assert.equal(snap.error.message, 'network down');
  });

  it('reports an error when the very first fetch fails', async () => {
    await assert.rejects(
      fetchIfNeeded('p1', 'k', () => Promise.reject(new Error('boom')), { staleTime: MINUTE })
    );
    const snap = getSnapshot('p1', 'k');
    assert.equal(snap.status, 'error');
    assert.equal(snap.data, undefined);
  });

  it('isolates failures to one key', async () => {
    await fetchIfNeeded('p1', 'gbp', countingFetcher('gbp-ok'), { staleTime: MINUTE });
    await assert.rejects(
      fetchIfNeeded('p1', 'gsc', () => Promise.reject(new Error('gsc down')), { staleTime: MINUTE })
    );

    assert.equal(getSnapshot('p1', 'gbp').status, 'success', 'a GSC failure must not affect GBP');
    assert.equal(getSnapshot('p1', 'gsc').status, 'error');
  });

  it('never serves one project data belonging to another', async () => {
    await fetchIfNeeded('p1', 'k', countingFetcher('project-one'), { staleTime: MINUTE });
    await fetchIfNeeded('p2', 'k', countingFetcher('project-two'), { staleTime: MINUTE });

    assert.equal(getSnapshot('p1', 'k').data, 'project-one');
    assert.equal(getSnapshot('p2', 'k').data, 'project-two');
  });

  it('evictProject removes only that project subtree', async () => {
    await fetchIfNeeded('p1', 'a', countingFetcher('1a'), { staleTime: MINUTE });
    await fetchIfNeeded('p1', 'b', countingFetcher('1b'), { staleTime: MINUTE });
    await fetchIfNeeded('p2', 'a', countingFetcher('2a'), { staleTime: MINUTE });

    evictProject('p1');

    assert.equal(getSnapshot('p1', 'a').status, 'idle');
    assert.equal(getSnapshot('p1', 'b').status, 'idle');
    assert.equal(getSnapshot('p2', 'a').data, '2a', 'other projects must be untouched');
    assert.equal(debugStats().projects, 1);
  });

  it('clearAll wipes everything, as sign-out requires', async () => {
    await fetchIfNeeded('p1', 'a', countingFetcher(), { staleTime: MINUTE });
    await fetchIfNeeded('p2', 'b', countingFetcher(), { staleTime: MINUTE });

    clearAll();

    assert.equal(debugStats().entries, 0);
    assert.equal(getSnapshot('p1', 'a').status, 'idle');
    assert.equal(getSnapshot('p2', 'b').status, 'idle');
  });

  it('setData publishes without a request, so an edit needs no refetch', () => {
    setData('p1', 'k', { name: 'edited' }, { staleTime: MINUTE });
    assert.deepEqual(getSnapshot('p1', 'k').data, { name: 'edited' });
    assert.equal(isFresh('p1', 'k'), true);
  });

  it('invalidate marks stale but keeps the data visible', async () => {
    const fetcher = countingFetcher('v1');
    await fetchIfNeeded('p1', 'k', fetcher, { staleTime: MINUTE });
    invalidate('p1', 'k');

    assert.equal(getSnapshot('p1', 'k').data, 'v1', 'data stays on screen');
    assert.equal(isFresh('p1', 'k'), false);

    await fetchIfNeeded('p1', 'k', fetcher, { staleTime: MINUTE });
    assert.equal(fetcher.calls, 2, 'an invalidated entry refetches');
  });

  it('getSnapshot returns a stable reference until something changes', async () => {
    // useSyncExternalStore loops forever if this is not true.
    const first = getSnapshot('p1', 'k');
    assert.equal(first, getSnapshot('p1', 'k'), 'the empty snapshot must be one singleton');

    await fetchIfNeeded('p1', 'k', countingFetcher(), { staleTime: MINUTE });
    const after = getSnapshot('p1', 'k');
    assert.equal(after, getSnapshot('p1', 'k'), 'a settled snapshot must keep its identity');
    assert.notEqual(after, first);
  });

  it('notifies only subscribers of the affected slot', async () => {
    let hits = 0;
    let otherHits = 0;
    subscribe('p1', 'watched', () => { hits += 1; });
    subscribe('p1', 'ignored', () => { otherHits += 1; });

    await fetchIfNeeded('p1', 'watched', countingFetcher(), { staleTime: MINUTE });

    assert.ok(hits > 0, 'the watched slot must notify');
    assert.equal(otherHits, 0, 'an unrelated slot must not re-render');
  });

  it('unsubscribe stops further notifications', async () => {
    let hits = 0;
    const off = subscribe('p1', 'k', () => { hits += 1; });
    off();
    await fetchIfNeeded('p1', 'k', countingFetcher(), { staleTime: MINUTE });
    assert.equal(hits, 0);
  });
});
