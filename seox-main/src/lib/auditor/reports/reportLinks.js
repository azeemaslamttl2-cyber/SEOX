export function pageExplorerHref(filter, label) {
  const params = new URLSearchParams({ filter });
  if (label) params.set("label", label);
  return `/auditor/pages?${params.toString()}`;
}

export function linkExplorerHref(filter, label) {
  const params = new URLSearchParams({ filter });
  if (label) params.set("label", label);
  return `/auditor/links?${params.toString()}`;
}
