const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Formats an `admin_settings.updated_at` value for display.
 *
 * The value arrives in one of two shapes: a MySQL datetime string
 * ("2026-09-10 12:24:56"), or a stringified Date, because mysql2 maps datetime
 * columns to Date objects and the settings service passes them through
 * `String(...)`.
 *
 * The previous version did `String(value).replace(" ", "T")` unconditionally.
 * `String.replace` with a string pattern swaps only the FIRST match, so a
 * stringified Date became "ThuTSep 10 2026 ..." - unparseable - and fell back
 * to printing the raw "Thu Sep 10 2026 12:24:56 GMT+0500 (Pakistan Standard
 * Time)" in the UI. Anything unparseable now returns "" so the caller can hide
 * the line instead of showing machine output.
 */
export function formatSettingDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = new Date(/^\d{4}-\d{2}-\d{2} /.test(raw) ? raw.replace(" ", "T") : raw);
  return Number.isNaN(parsed.getTime()) ? "" : DATE_FORMAT.format(parsed);
}
