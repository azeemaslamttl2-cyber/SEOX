export const EMPTY_EEAT_RESULT = {
  url: "",
  score: 0,
  rating: "Not run",
  passedChecks: 0,
  failedChecks: 0,
  totalAutomated: 0,
  manualCompleted: 0,
  manualTotal: 47,
  cachedAgo: "Not run",
  sections: [],
};

export function normalizeEeatResult(rawResult, fallbackUrl = "") {
  const safeResult = rawResult && typeof rawResult === "object" ? rawResult : {};

  return {
    ...EMPTY_EEAT_RESULT,
    ...safeResult,
    url: safeResult.url || fallbackUrl || "",
    sections: Array.isArray(safeResult.sections) ? safeResult.sections : [],
  };
}
