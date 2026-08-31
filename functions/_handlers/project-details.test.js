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
