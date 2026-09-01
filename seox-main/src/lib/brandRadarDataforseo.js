import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

export const DEFAULT_BRAND_RADAR_CONFIG = {
  brand: "PlayStation",
  domain: "playstation.com",
  competitors: ["Xbox", "Nintendo"],
  location_code: 2840,
  language_code: "en",
};

export const DATAFORSEO_BRAND_RADAR_PLATFORMS = [
  { key: "all", label: "AI Overview + ChatGPT" },
  { key: "google", label: "Google AI Overview" },
  { key: "chat_gpt", label: "ChatGPT" },
];

const STORAGE_KEY = "seox-brand-radar-config";

export function formatCompactNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  if (Math.abs(number) >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(number >= 10_000_000_000 ? 0 : 1)}B`;
  if (Math.abs(number) >= 1_000_000) return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1)}M`;
  if (Math.abs(number) >= 1_000) return `${(number / 1_000).toFixed(number >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(number));
}

export function formatPercent(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0%";
  return `${number.toFixed(number >= 10 ? 1 : 2)}%`;
}

export function normalizeBrandInput(input) {
  const value = String(input || "").trim();
  if (!value) return { name: "", domain: "" };
  const withoutProtocol = value.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const host = withoutProtocol.split(/[/?#]/)[0];
  const looksLikeDomain = /\.[a-z]{2,}$/i.test(host);
  if (!looksLikeDomain) return { name: value, domain: "" };
  const firstLabel = host.split(".")[0] || value;
  const name = firstLabel
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return { name, domain: host.toLowerCase() };
}

export function readStoredBrandRadarConfig() {
  if (typeof window === "undefined") return DEFAULT_BRAND_RADAR_CONFIG;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    return normalizeConfig(stored || DEFAULT_BRAND_RADAR_CONFIG);
  } catch {
    return DEFAULT_BRAND_RADAR_CONFIG;
  }
}

export function saveBrandRadarConfig(config) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeConfig(config)));
}

export function buildBrandRadarSearch(config) {
  const normalized = normalizeConfig(config);
  const params = new URLSearchParams();
  params.set("brand", normalized.brand);
  if (normalized.domain) params.set("domain", normalized.domain);
  if (normalized.competitors.length) params.set("competitors", normalized.competitors.join(","));
  params.set("location", String(normalized.location_code));
  params.set("language", normalized.language_code);
  return params.toString();
}

export function normalizeConfig(config) {
  const parsedBrand = normalizeBrandInput(config?.brand || config?.domain || DEFAULT_BRAND_RADAR_CONFIG.brand);
  const competitors = Array.isArray(config?.competitors)
    ? config.competitors
    : String(config?.competitors || DEFAULT_BRAND_RADAR_CONFIG.competitors.join(",")).split(",");

  return {
    brand: String(config?.brand || parsedBrand.name || DEFAULT_BRAND_RADAR_CONFIG.brand).trim(),
    domain: String(config?.domain || parsedBrand.domain || "").trim(),
    competitors: competitors.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 9),
    location_code: Number(config?.location_code || config?.location || DEFAULT_BRAND_RADAR_CONFIG.location_code),
    language_code: String(config?.language_code || config?.language || DEFAULT_BRAND_RADAR_CONFIG.language_code).trim() || "en",
  };
}

export function useBrandRadarConfig() {
  const location = useLocation();
  return useMemo(() => {
    const stored = readStoredBrandRadarConfig();
    const params = new URLSearchParams(location.search);
    const urlConfig = {
      brand: params.get("brand") || stored.brand,
      domain: params.get("domain") || stored.domain,
      competitors: params.get("competitors") || stored.competitors,
      location_code: params.get("location") || stored.location_code,
      language_code: params.get("language") || stored.language_code,
    };
    return normalizeConfig(urlConfig);
  }, [location.search]);
}

export function getBrandRadarTargets(config) {
  const normalized = normalizeConfig(config);
  return [
    { name: normalized.brand, domain: normalized.domain },
    ...normalized.competitors.map((name) => ({ name })),
  ].filter((item) => item.name || item.domain);
}

export function useBrandRadarMetrics(config) {
  return useBrandRadarAction("brand_radar_cross_metrics", config, {
    targets: getBrandRadarTargets(config),
    platform: "all",
  });
}

export function useBrandRadarSearchMentions(config, platform = "google", limit = 25) {
  return useBrandRadarAction("brand_radar_search_mentions", config, {
    targets: getBrandRadarTargets(config).slice(0, 1),
    platform,
    limit,
  });
}

export function useBrandRadarTopPages(config, platform = "google", limit = 25) {
  return useBrandRadarAction("brand_radar_top_pages", config, {
    targets: getBrandRadarTargets(config).slice(0, 1),
    platform,
    limit,
  });
}

export function useBrandRadarTopDomains(config, platform = "google", limit = 15) {
  return useBrandRadarAction("brand_radar_top_domains", config, {
    targets: getBrandRadarTargets(config).slice(0, 1),
    platform,
    limit,
  });
}

export function useBrandRadarKeywordVolume(config) {
  const keywords = getBrandRadarTargets(config).map((target) => target.name).filter(Boolean);
  return useBrandRadarAction("brand_radar_ai_search_volume", config, { keywords });
}

export function useBrandRadarAction(action, config, extraBody) {
  const normalized = normalizeConfig(config);
  const body = useMemo(() => ({
    service: "dataforseo",
    action,
    brand: normalized.brand,
    domain: normalized.domain,
    competitors: normalized.competitors,
    location_code: normalized.location_code,
    language_code: normalized.language_code,
    ...extraBody,
  }), [action, normalized.brand, normalized.domain, normalized.competitors.join("|"), normalized.location_code, normalized.language_code, JSON.stringify(extraBody)]);

  const [state, setState] = useState({
    data: null,
    loading: false,
    error: "",
    hasLoaded: false,
  });

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const response = await fetch("/api/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.error) {
          throw new Error(payload.message || payload.status_message || payload.error || "DataForSEO request failed");
        }
        if (!cancelled) setState({ data: payload, loading: false, error: "", hasLoaded: true });
      } catch (error) {
        if (!cancelled) {
          setState({ data: null, loading: false, error: error?.message || "DataForSEO request failed", hasLoaded: true });
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [body]);

  return state;
}
