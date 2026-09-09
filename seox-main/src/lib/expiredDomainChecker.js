const RESERVED_TLDS = new Set(["example", "invalid", "localhost", "test"]);

export function normalizeDomainToken(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";

  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return raw
      .replace(/^https?:\/\//i, "")
      .split(/[/?#]/)[0]
      .replace(/^www\./, "");
  }
}

export function canCheckDomain(domain) {
  if (!domain || domain.length > 253 || domain.includes("_") || /^\d+\.\d+\.\d+\.\d+$/.test(domain)) return false;
  const parts = domain.split(".");
  if (parts.length < 2) return false;

  const tld = parts.at(-1);
  if (!/^[a-z]{2,63}$/.test(tld) || RESERVED_TLDS.has(tld)) return false;

  return parts.every((part) => (
    part.length > 0 &&
    part.length <= 63 &&
    /^[a-z0-9-]+$/.test(part) &&
    !part.startsWith("-") &&
    !part.endsWith("-")
  ));
}

export function prepareExpiredDomainInput(domains) {
  const domainList = String(domains || "").split(/[\n, ]+/).filter((domain) => domain.trim());
  const normalized = [];
  const rejected = [];
  const seen = new Set();

  domainList.forEach((item) => {
    const domain = normalizeDomainToken(item);
    if (canCheckDomain(domain) && !seen.has(domain)) {
      normalized.push(domain);
      seen.add(domain);
    } else {
      rejected.push(item);
    }
  });

  return { domainList, normalized, rejected };
}

export function checkExpiredDomains(domains, random = Math.random, checkedAt = () => new Date().toLocaleTimeString()) {
  const prepared = prepareExpiredDomainInput(domains);
  return {
    ...prepared,
    results: prepared.normalized.map((domain) => ({
      domain: domain.trim(),
      available: random() > 0.6,
      tld: domain.trim().split(".").pop(),
      checkedAt: checkedAt(),
    })),
  };
}
