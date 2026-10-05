import test from "node:test";
import assert from "node:assert/strict";
import {
  createProjectDetailsHandler,
  createProjectInsertHandler,
  validateProjectDetailsInput,
} from "./project-details.js";

test("returns only the requested project fields for a valid url and admin token", async () => {
  const calls = [];
  const getProjectDetails = createProjectDetailsHandler(async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { id: 7 };
    return {
      project_id: "project-1",
      project_data: { status: "ready" },
      full_url: "https://example.com",
      project_name: "Example",
    };
  });

  const project = await getProjectDetails({ admin_token: "secret", url: "https://example.com" });
  assert.deepEqual(project, {
    project_id: "project-1",
    project_data: { status: "ready" },
    full_url: "https://example.com",
    project_name: "Example",
  });
  assert.equal(calls[0].params[0], "secret");
  assert.equal(calls[1].params[0], "example.com");
});

test("rejects a missing admin token with 400", async () => {
  const getProjectDetails = createProjectDetailsHandler(async () => null);
  await assert.rejects(
    getProjectDetails({ url: "https://example.com" }),
    { status: 400, message: "admin_token is required" }
  );
});

test("normalizes project_data JSON strings into an object", async () => {
  const calls = [];
  const getProjectDetails = createProjectDetailsHandler(async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { id: 7 };
    return {
      project_id: "project-1",
      project_data: '{"status":"ready"}',
      full_url: "https://example.com",
      project_name: "Example",
    };
  });

  const project = await getProjectDetails({ admin_token: "secret", url: "https://example.com" });
  assert.deepEqual(project.project_data, { status: "ready" });
});

test("rejects a missing project with 404", async () => {
  const calls = [];
  const getProjectDetails = createProjectDetailsHandler(async (sql, params) => {
    calls.push({ sql, params });
    return calls.length === 1 ? { id: 7 } : null;
  });
  await assert.rejects(
    getProjectDetails({ admin_token: "secret", url: "https://missing.example.com" }),
    { status: 404, message: "Project not found" }
  );
});

test("rejects duplicate project_id when adding a project", async () => {
  const calls = [];
  const insertProject = createProjectInsertHandler(
    async (sql, params) => {
      calls.push({ type: "queryOne", sql, params });
      if (calls.length === 1) return { id: "admin-1" };
      return { project_id: "project-1" };
    },
    async (sql, params) => {
      calls.push({ type: "query", sql, params });
      return {};
    }
  );

  await assert.rejects(
    insertProject({
      admin_token: "secret",
      project_id: "project-1",
      project_name: "Example Project",
      full_url: "https://example.com",
      project_data: { status: "ready" },
    }),
    { status: 409, message: "Project ID already exists" }
  );

  assert.equal(calls[0].params[0], "secret");
  assert.deepEqual(calls[1].params, ["admin-1", "project-1"]);
});

test("rejects duplicate website URL when adding a project", async () => {
  const calls = [];
  const insertProject = createProjectInsertHandler(
    async (sql, params) => {
      calls.push({ type: "queryOne", sql, params });
      if (calls.length === 1) return { id: "admin-1" };
      if (calls.length === 2) return null;
      return { project_id: "project-1" };
    },
    async (sql, params) => {
      calls.push({ type: "query", sql, params });
      return {};
    }
  );

  await assert.rejects(
    insertProject({
      admin_token: "secret",
      project_id: "project-2",
      project_name: "Duplicate Example",
      full_url: "https://example.com",
      project_data: { status: "ready" },
    }),
    { status: 409, message: "Website URL already exists" }
  );

  assert.equal(calls[0].params[0], "secret");
  assert.deepEqual(calls[1].params, ["admin-1", "project-2"]);
  assert.deepEqual(calls[2].params, ["admin-1", "example.com"]);
});

test("validates required request parameters", () => {
  assert.throws(() => validateProjectDetailsInput({}), { status: 400 });
  assert.throws(() => validateProjectDetailsInput({ url: "" }), { status: 400 });
});

test("returns all data when feature parameter is not provided (backward compatibility)", async () => {
  const projectData = {
    eeat: { result: { score: 85 } },
    speed_test: { result: { score: 90 } },
    owner: "Admin User",
    ownerEmail: "test@example.com",
  };

  const getProjectDetails = createProjectDetailsHandler(async (sql, params) => {
    if (params[0] === "secret") return { id: 7 };
    return {
      project_id: "project-1",
      project_data: projectData,
      full_url: "https://example.com",
      project_name: "Example",
    };
  });

  const project = await getProjectDetails({ admin_token: "secret", url: "https://example.com" });
  assert.deepEqual(project.project_data, projectData);
});

test("returns only the requested feature (e.g., eeat)", async () => {
  const projectData = {
    eeat: JSON.stringify({ result: { score: 85 } }),
    speed_test: JSON.stringify({ result: { score: 90 } }),
    semantic: JSON.stringify({ result: { seoScore: 75 } }),
    owner: "Admin User",
    ownerEmail: "test@example.com",
  };

  const getProjectDetails = createProjectDetailsHandler(async (sql, params) => {
    if (params[0] === "secret") return { id: 7 };
    return {
      project_id: "project-1",
      project_data: projectData,
      full_url: "https://example.com",
      project_name: "Example",
    };
  });

  const project = await getProjectDetails({
    admin_token: "secret",
    url: "https://example.com",
    feature: "eeat",
  });

  assert.deepEqual(project.project_data, {
    eeat: { result: { score: 85 } },
  });
});

test("returns only the requested feature (e.g., speed_test)", async () => {
  const projectData = {
    eeat: JSON.stringify({ result: { score: 85 } }),
    speed_test: JSON.stringify({ result: { score: 90 } }),
    semantic: JSON.stringify({ result: { seoScore: 75 } }),
    owner: "Admin User",
    ownerEmail: "test@example.com",
  };

  const getProjectDetails = createProjectDetailsHandler(async (sql, params) => {
    if (params[0] === "secret") return { id: 7 };
    return {
      project_id: "project-1",
      project_data: projectData,
      full_url: "https://example.com",
      project_name: "Example",
    };
  });

  const project = await getProjectDetails({
    admin_token: "secret",
    url: "https://example.com",
    feature: "speed_test",
  });

  assert.deepEqual(project.project_data, {
    speed_test: { result: { score: 90 } },
  });
});

test("normalizes speed feature name to speed_test", async () => {
  const projectData = {
    eeat: JSON.stringify({ result: { score: 85 } }),
    speed_test: JSON.stringify({ result: { score: 90 } }),
    owner: "Admin User",
    ownerEmail: "test@example.com",
  };

  const getProjectDetails = createProjectDetailsHandler(async (sql, params) => {
    if (params[0] === "secret") return { id: 7 };
    return {
      project_id: "project-1",
      project_data: projectData,
      full_url: "https://example.com",
      project_name: "Example",
    };
  });

  const project = await getProjectDetails({
    admin_token: "secret",
    url: "https://example.com",
    feature: "speed",
  });

  assert.deepEqual(project.project_data, {
    speed_test: { result: { score: 90 } },
  });
});

test("handles feature names case-insensitively", async () => {
  const projectData = {
    eeat: JSON.stringify({ result: { score: 85 } }),
    speed_test: JSON.stringify({ result: { score: 90 } }),
    owner: "Admin User",
    ownerEmail: "test@example.com",
  };

  const getProjectDetails = createProjectDetailsHandler(async (sql, params) => {
    if (params[0] === "secret") return { id: 7 };
    return {
      project_id: "project-1",
      project_data: projectData,
      full_url: "https://example.com",
      project_name: "Example",
    };
  });

  const project = await getProjectDetails({
    admin_token: "secret",
    url: "https://example.com",
    feature: "EEAT",
  });

  assert.deepEqual(project.project_data, {
    eeat: { result: { score: 85 } },
  });
});

test("returns 404 error when requested feature does not exist", async () => {
  const projectData = {
    eeat: JSON.stringify({ result: { score: 85 } }),
    speed_test: JSON.stringify({ result: { score: 90 } }),
    owner: "Admin User",
    ownerEmail: "test@example.com",
  };

  const getProjectDetails = createProjectDetailsHandler(async (sql, params) => {
    if (params[0] === "secret") return { id: 7 };
    return {
      project_id: "project-1",
      project_data: projectData,
      full_url: "https://example.com",
      project_name: "Example",
    };
  });

  await assert.rejects(
    getProjectDetails({
      admin_token: "secret",
      url: "https://example.com",
      feature: "nonexistent",
    }),
    { status: 404, message: /Feature 'nonexistent' not found/ }
  );
});

test("returns 404 error when feature not available (empty features)", async () => {
  const projectData = {
    owner: "Admin User",
    ownerEmail: "test@example.com",
  };

  const getProjectDetails = createProjectDetailsHandler(async (sql, params) => {
    if (params[0] === "secret") return { id: 7 };
    return {
      project_id: "project-1",
      project_data: projectData,
      full_url: "https://example.com",
      project_name: "Example",
    };
  });

  await assert.rejects(
    getProjectDetails({
      admin_token: "secret",
      url: "https://example.com",
      feature: "eeat",
    }),
    { status: 404, message: /Feature 'eeat' not found/ }
  );
});

test("parses JSON string feature values correctly", async () => {
  const projectData = {
    eeat: '{"result":{"score":85},"updatedAt":"2026-07-31"}',
    speed_test: JSON.stringify({ result: { score: 90 } }),
    owner: "Admin User",
    ownerEmail: "test@example.com",
  };

  const getProjectDetails = createProjectDetailsHandler(async (sql, params) => {
    if (params[0] === "secret") return { id: 7 };
    return {
      project_id: "project-1",
      project_data: projectData,
      full_url: "https://example.com",
      project_name: "Example",
    };
  });

  const project = await getProjectDetails({
    admin_token: "secret",
    url: "https://example.com",
    feature: "eeat",
  });

  assert.deepEqual(project.project_data, {
    eeat: { result: { score: 85 }, updatedAt: "2026-07-31" },
  });
});

function gscHandler(resolveGscData, projectData) {
  return createProjectDetailsHandler(
    async (sql) =>
      sql.includes("FROM users")
        ? { id: 7 }
        : {
            project_id: "project-1",
            project_data: projectData,
            full_url: "https://example.com",
            project_name: "Example",
            user_id: 3,
            domain: "example.com",
          },
    { resolveGscData }
  );
}

const auditData = { signedIn: true, metrics: {}, topQueries: [], fetchedAt: "2026-10-02T00:00:00.000Z" };
const insightsData = { signedIn: true, summary: {}, keywords: [], fetchedAt: "2026-10-02T00:00:01.000Z" };

test("adds GSC Audit and Insights under their own keys and leaves project_data.gsc alone", async () => {
  const seen = [];
  const dashboardGsc = { status: "complete", metrics: { clicks: 5 } };
  const project = await gscHandler(
    async (args) => {
      seen.push(args);
      return {
        gsc_audit: { data: auditData, status: "fresh" },
        gsc_insights: { data: insightsData, status: "cached" },
      };
    },
    { speed_test: { score: 90 }, gsc: dashboardGsc }
  )({ admin_token: "secret", url: "https://example.com", refresh: "1" });

  assert.deepEqual(project.project_data, {
    speed_test: { score: 90 },
    gsc: dashboardGsc,
    gsc_audit: auditData,
    gsc_insights: insightsData,
  });
  assert.deepEqual(project.gsc_audit_status, { status: "fresh", fetched_at: auditData.fetchedAt });
  assert.deepEqual(project.gsc_insights_status, { status: "cached", fetched_at: insightsData.fetchedAt });
  assert.equal(project.user_id, undefined);
  assert.equal(project.domain, undefined);
  assert.equal(seen.length, 1, "one resolver call covers both modules");
  assert.deepEqual(seen[0].want, ["gsc_audit", "gsc_insights"]);
  assert.equal(seen[0].project.user_id, 3);
  assert.equal(seen[0].force, true);
});

test("a GSC failure keeps saved data and project_data, and reports the error", async () => {
  const project = await gscHandler(
    async () => ({
      gsc_audit: { data: auditData, status: "error", error: { code: "GSC_NOT_CONNECTED", message: "nope" } },
      gsc_insights: { data: null, status: "error", error: { code: "GSC_NOT_CONNECTED", message: "nope" } },
    }),
    { gsc_audit: auditData, speed_test: { score: 90 } }
  )({ admin_token: "secret", url: "https://example.com" });

  assert.equal(project.project_data.speed_test.score, 90);
  assert.deepEqual(project.project_data.gsc_audit, auditData);
  assert.equal("gsc_insights" in project.project_data, false);
  assert.equal(project.gsc_audit_status.error.code, "GSC_NOT_CONNECTED");
  assert.equal(project.gsc_insights_status.status, "error");
});

test("a throwing-free resolver result of nothing leaves the response untouched", async () => {
  const project = await gscHandler(async () => ({}), { speed_test: { score: 90 } })({
    admin_token: "secret",
    url: "https://example.com",
  });
  assert.deepEqual(project.project_data, { speed_test: { score: 90 } });
  assert.equal("gsc_audit_status" in project, false);
});

test("feature filter selects which GSC modules run", async () => {
  const wants = [];
  const resolver = async ({ want }) => {
    wants.push(want);
    return { gsc_audit: { data: auditData, status: "cached" }, gsc_insights: { data: insightsData, status: "cached" } };
  };
  await gscHandler(resolver, { speed_test: { score: 1 } })({ admin_token: "s", url: "https://example.com", feature: "speed" });
  assert.deepEqual(wants, [], "unrelated features make no Google call");

  const audit = await gscHandler(resolver, {})({ admin_token: "s", url: "https://example.com", feature: "gsc-audit" });
  assert.deepEqual(wants[0], ["gsc_audit"]);
  assert.deepEqual(Object.keys(audit.project_data), ["gsc_audit"]);

  const insights = await gscHandler(resolver, {})({ admin_token: "s", url: "https://example.com", feature: "gsc_insights" });
  assert.deepEqual(wants[1], ["gsc_insights"]);
  assert.deepEqual(Object.keys(insights.project_data), ["gsc_insights"]);
});

test("feature=gsc still returns the dashboard value, untouched", async () => {
  const project = await gscHandler(async () => ({}), { gsc: { status: "complete" } })({
    admin_token: "s",
    url: "https://example.com",
    feature: "gsc",
  });
  assert.deepEqual(project.project_data, { gsc: { status: "complete" } });
});

test("feature=gsc_audit with a failed run and nothing saved returns null and the error, not 404", async () => {
  const project = await gscHandler(
    async () => ({ gsc_audit: { data: null, status: "error", error: { code: "GSC_NOT_CONNECTED", message: "x" } } }),
    { speed_test: { score: 1 } }
  )({ admin_token: "s", url: "https://example.com", feature: "gsc_audit" });
  assert.deepEqual(project.project_data, { gsc_audit: null });
  assert.equal(project.gsc_audit_status.error.code, "GSC_NOT_CONNECTED");
});
