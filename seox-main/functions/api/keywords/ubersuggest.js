import { onRequest as autocompleteOnRequest } from "../autocomplete.js";
import { configureMysqlConnection, queryOne } from "../../_lib/mysql.js";
import { AUTOCOMPLETE_REGIONS, UBERSUGGEST_CATEGORIES, uniqueKeywords } from "../../../src/lib/keywordTools.js";

const MAX_TOKEN_LENGTH = 512;
const BATCH_SIZE = 4;

function json(payload, status = 200) {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

function error(message, status = 400) {
  return json({ success: false, error: message }, status);
}

async function validateAdminToken(value, env) {
  const token = typeof value === "string" ? value.trim() : "";
  if (!token) return error("Admin token is required.", 401);
  if (token.length > MAX_TOKEN_LENGTH) return error("Invalid admin token.", 401);

  configureMysqlConnection(env);
  const admin = await queryOne(
    `SELECT id FROM users
     WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL
     LIMIT 1`,
    [token]
  );
  return admin ? null : error("Invalid admin token.", 401);
}

function findRegion(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  return AUTOCOMPLETE_REGIONS.find((region) => (
    region.gl.toLowerCase() === raw || region.name.toLowerCase() === raw
  )) || null;
}

function buildTasks(seed, region) {
  const tasks = [];
  Object.entries(UBERSUGGEST_CATEGORIES).forEach(([categoryKey, category]) => {
    category.modifiers.forEach((modifier) => {
      tasks.push({ key: `${categoryKey}:${modifier}`, query: category.buildQuery(seed, modifier), region });
      category.subModifiers?.[modifier]?.forEach((subModifier) => {
        tasks.push({ key: `${categoryKey}:${modifier}`, query: category.buildQuery(seed, subModifier), region });
      });
    });
  });
  return tasks;
}

async function fetchSuggestions(query, region) {
  const url = new URL("http://localhost/api/autocomplete");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", region.hl || "en");
  url.searchParams.set("gl", region.gl || "US");
  const response = await autocompleteOnRequest({
    request: new Request(url, { method: "GET" }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || "Could not fetch autocomplete suggestions"), { status: response.status });
  return uniqueKeywords(payload.suggestions || []);
}

async function fetchBatch(tasks) {
  const fetched = {};
  for (let index = 0; index < tasks.length; index += BATCH_SIZE) {
    const batch = tasks.slice(index, index + BATCH_SIZE);
    const values = await Promise.all(batch.map(async (task) => ({
      key: task.key,
      suggestions: await fetchSuggestions(task.query, task.region),
    })));
    values.forEach((value) => {
      fetched[value.key] = uniqueKeywords([...(fetched[value.key] || []), ...value.suggestions]);
    });
  }
  return fetched;
}

function buildResults(seed, fetched) {
  const results = {};
  Object.entries(UBERSUGGEST_CATEGORIES).forEach(([categoryKey, category]) => {
    results[categoryKey] = Object.fromEntries(
      category.modifiers.map((modifier) => [
        modifier,
        uniqueKeywords(fetched[`${categoryKey}:${modifier}`] || []),
      ])
    );
  });
  return results;
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return error("Method not allowed", 405);

  try {
    const body = await request.json().catch(() => null);
    const tokenError = await validateAdminToken(body?.admin_token, env);
    if (tokenError) return tokenError;

    const seed = String(body?.keyword || "").trim();
    if (!seed) return error("Keyword is required.", 400);
    const region = findRegion(body?.country);
    if (!region) return error("Country is required or invalid.", 422);

    const fetched = await fetchBatch(buildTasks(seed, region));
    return json({
      success: true,
      data: buildResults(seed, fetched),
      keyword: seed,
      country: region.name,
      country_code: region.gl,
      language: region.hl,
    });
  } catch (caught) {
    return error(caught?.message || "Could not fetch Ubersuggest keyword ideas.", caught?.status || 500);
  }
}
