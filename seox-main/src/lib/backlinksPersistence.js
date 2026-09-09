export function buildBacklinksToolResult({
  backlinks = [],
  fileName = "No file loaded",
  csvFormat = "domain",
  nicheKeywords = "",
  pasteInput = "",
  enabledChecks = {},
  filter = "all",
}) {
  return {
    status: backlinks.length ? "ready" : "idle",
    backlinks,
    fileName,
    csvFormat,
    nicheKeywords,
    pasteInput,
    enabledChecks,
    filter,
    updatedAt: new Date().toISOString(),
  };
}
