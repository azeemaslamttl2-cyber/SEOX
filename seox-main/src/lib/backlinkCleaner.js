export function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function getCell(row, headers, names) {
  const lowered = names.map((name) => name.toLowerCase());
  const index = headers.findIndex((header) => lowered.includes(header.toLowerCase()));
  return index >= 0 ? row[index] : "";
}

function domainFromValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//i, "").split(/[/?#]/)[0].replace(/^www\./i, "").toLowerCase();
  }
}

export function classifyIssues(row) {
  if (row.issues && row.issues !== "Unknown") return row.issues;
  const haystack = `${row.domain} ${row.url} ${row.title} ${row.category}`.toLowerCase();
  const tld = row.domain.split(".").pop();
  if (["xyz", "top", "click", "link", "quest", "rest"].includes(tld)) return "Spammy TLD";
  if (/\b(casino|gambling|betting|poker|adult|porn|escort)\b/.test(haystack)) return "Adult/Gambling";
  if (row.dr > 0 && row.dr < 20) return "Low Authority";
  if (row.status && !/^2\d\d$|^live$/i.test(String(row.status))) return "HTTP Error";
  return "Clean";
}

export function normalizeRows(text) {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];

  const first = parseCsvLine(lines[0]);
  const looksHeader = first.some((cell) => /domain|url|title|dr|authority|status|issue|category/i.test(cell));
  const headers = looksHeader ? first.map((cell) => cell.trim()) : [];
  const dataLines = looksHeader ? lines.slice(1) : lines;

  return dataLines.map((line, index) => {
    const cells = parseCsvLine(line);
    const url = getCell(cells, headers, ["url", "backlink", "source url", "referring page"]) || cells[0] || "";
    const domain = domainFromValue(getCell(cells, headers, ["domain", "referring domain"]) || url);
    const drValue = getCell(cells, headers, ["dr", "domain rating", "da", "authority"]) || cells[2] || "";
    const row = {
      id: `${domain || "row"}-${index}`,
      domain: domain || "unknown-domain",
      url,
      dr: Number.parseInt(String(drValue).replace(/[^\d]/g, ""), 10) || 0,
      category: getCell(cells, headers, ["category", "type", "niche"]) || "Uncategorized",
      title: getCell(cells, headers, ["title", "page title", "anchor"]) || "Not extracted",
      status: getCell(cells, headers, ["status", "http status"]) || "Unknown",
      issues: getCell(cells, headers, ["issues", "issue", "risk"]) || "Unknown",
    };
    return { ...row, issues: classifyIssues(row) };
  }).filter((row) => row.domain && row.domain !== "unknown-domain");
}

export function computeStats(rows) {
  const clean = rows.filter((row) => row.issues === "Clean").length;
  const flagged = rows.length - clean;
  const avgDr = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.dr, 0) / rows.length) : 0;
  return {
    totalLinks: rows.length,
    clean,
    flagged,
    avgDR: avgDr,
    scanned: rows.length,
    excluded: 0,
  };
}
