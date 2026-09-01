export const MAX_LOCAL_EXPIRED_SCAN_SIZE = 500;

export function buildLocationJobs(locations, selectedLimit) {
  const perArea = selectedLimit <= 60;
  const requested = perArea
    ? Math.min(MAX_LOCAL_EXPIRED_SCAN_SIZE, selectedLimit * locations.length)
    : Math.min(MAX_LOCAL_EXPIRED_SCAN_SIZE, selectedLimit);
  let remaining = requested;
  const jobs = [];

  for (const location of locations) {
    if (remaining <= 0) break;
    const target = Math.min(perArea ? selectedLimit : 60, remaining);
    jobs.push({ location, target });
    remaining -= target;
  }

  return { jobs, requested, capacity: jobs.reduce((total, job) => total + job.target, 0) };
}

export function chunkItems(items, size) {
  return Array.from(
    { length: Math.ceil(items.length / size) },
    (_, index) => items.slice(index * size, (index + 1) * size),
  );
}

export function summarizeDomainChecks(results) {
  const summary = { checked: 0, available: 0, expired: 0, expiring: 0, registered: 0, unknown: 0, opportunities: 0 };
  results.forEach((result) => {
    summary.checked += 1;
    if (result.availableNow) summary.available += 1;
    else if (result.status === 'Expired') summary.expired += 1;
    else if (result.status === 'Expiring') summary.expiring += 1;
    else if (result.status === 'Registered') summary.registered += 1;
    else summary.unknown += 1;
    if (result.opportunity) summary.opportunities += 1;
  });
  return summary;
}
