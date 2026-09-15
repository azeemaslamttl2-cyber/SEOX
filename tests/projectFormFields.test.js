import test from "node:test";
import assert from "node:assert/strict";
import {
  applyFormValuesToProject,
  buildCrawlUrl,
  isValidProjectDomain,
  normalizeProjectUrlValue,
  projectToFormValues,
  validateProjectForm,
} from "../src/lib/projectFormFields.js";

const storedProject = {
  id: "proj_1",
  project_id: "proj_1",
  name: "Example",
  project_name: "Example",
  domain: "example.com",
  fullUrl: "https://example.com",
  full_url: "https://example.com",
  protocol: "https-http",
  scope: "subdomains",
  folder: "none",
  schedule: "weekly",
  user_agent: "seox-desktop",
  url_limit: 10000,
  render_js: false,
  respect_robots: true,
  notify_email: true,
  owner_uid: "7",
  created_at: "2026-01-01 09:00:00",
  project_data: { auditor: { status: "complete" }, createdAt: "2026-01-01T09:00:00.000Z" },
};

test("form values are read from either key style", () => {
  const values = projectToFormValues(storedProject);
  assert.equal(values.name, "Example");
  assert.equal(values.domain, "example.com");
  assert.equal(values.userAgent, "seox-desktop");
  assert.equal(values.urlLimit, 10000);
  assert.equal(values.respectRobots, true);
  assert.equal(values.renderJs, false);
});

test("an edit writes both key styles and refreshes updated_at", () => {
  const next = applyFormValuesToProject(storedProject, {
    ...projectToFormValues(storedProject),
    name: "Renamed",
    schedule: "daily",
    urlLimit: 250,
    renderJs: true,
  });

  assert.equal(next.name, "Renamed");
  assert.equal(next.project_name, "Renamed");
  assert.equal(next.schedule, "daily");
  assert.equal(next.urlLimit, 250);
  assert.equal(next.url_limit, 250);
  assert.equal(next.renderJs, true);
  assert.equal(next.render_js, true);
  assert.equal(next.project_data.schedule, "daily");
  assert.notEqual(next.updated_at, storedProject.updated_at);
});

test("an edit preserves identity, ownership and saved audit data", () => {
  const next = applyFormValuesToProject(storedProject, {
    ...projectToFormValues(storedProject),
    name: "Renamed",
  });

  assert.equal(next.id, "proj_1");
  assert.equal(next.project_id, "proj_1");
  assert.equal(next.owner_uid, "7");
  assert.equal(next.created_at, "2026-01-01 09:00:00");
  assert.deepEqual(next.project_data.auditor, { status: "complete" });
});

test("changing the domain rebuilds the crawl URL from the protocol", () => {
  const next = applyFormValuesToProject(storedProject, {
    ...projectToFormValues(storedProject),
    domain: "https://www.NewSite.com/",
    protocol: "http",
  });

  assert.equal(next.domain, "newsite.com");
  assert.equal(next.fullUrl, "http://newsite.com");
  assert.equal(next.full_url, "http://newsite.com");
});

test("an empty name falls back to the domain", () => {
  const next = applyFormValuesToProject(storedProject, {
    ...projectToFormValues(storedProject),
    name: "   ",
  });
  assert.equal(next.name, "example.com");
});

test("validation rejects an invalid domain and a bad URL limit", () => {
  const errors = validateProjectForm(
    { domain: "nope", urlLimit: 0 },
    { projects: [], currentProjectId: "proj_1" }
  );
  assert.ok(errors.domain);
  assert.ok(errors.urlLimit);
});

test("validation rejects a website another project already uses", () => {
  const errors = validateProjectForm(
    { domain: "taken.com", urlLimit: 100 },
    {
      projects: [storedProject, { id: "proj_2", domain: "taken.com" }],
      currentProjectId: "proj_1",
    }
  );
  assert.equal(errors.domain, "Another project already uses this website.");
});

test("validation ignores the project being edited, so a no-op save passes", () => {
  const errors = validateProjectForm(
    { domain: "example.com", urlLimit: 100 },
    { projects: [storedProject], currentProjectId: "proj_1" }
  );
  assert.deepEqual(errors, {});
});

test("www and protocol variants of the same site count as a clash", () => {
  const errors = validateProjectForm(
    { domain: "https://www.example.com", urlLimit: 100 },
    { projects: [storedProject], currentProjectId: "proj_2" }
  );
  assert.ok(errors.domain);
});

test("domain and URL helpers normalise consistently", () => {
  assert.equal(normalizeProjectUrlValue("https://WWW.Example.com/", { stripTrailingSlash: true }), "example.com");
  assert.equal(buildCrawlUrl("example.com", "https-http"), "https://example.com");
  assert.equal(buildCrawlUrl("example.com", "http"), "http://example.com");
  assert.equal(isValidProjectDomain("example.com"), true);
  assert.equal(isValidProjectDomain("nope"), false);
  assert.equal(isValidProjectDomain(""), false);
});
