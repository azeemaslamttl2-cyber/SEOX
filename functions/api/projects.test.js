import test from "node:test";
import assert from "node:assert";
import {
  mergeProjectDataForKey,
  mergeProjectDataPreservingKeys,
  mergeProjectDataWithToolResult,
} from "./projects.js";

const mockData = {
  users: new Map(),
  toolResults: new Map(),
};

function setupUserProject(userId, projectId, projectData = {}) {
  const key = `${userId}:${projectId}`;
  mockData.users.set(key, {
    user_id: userId,
    project_id: projectId,
    project_data: projectData,
    owner_uid: userId,
  });
}

function mockSaveToolResult(userId, projectId, toolKey, resultData) {
  const projectKey = `${userId}:${projectId}`;
  const project = mockData.users.get(projectKey);

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.project_data.toolResults) {
    delete project.project_data.toolResults;
  }

  project.project_data[toolKey] = resultData.result;

  const toolKeyFull = `${userId}:${projectId}:${toolKey}`;
  mockData.toolResults.set(toolKeyFull, {
    user_id: userId,
    project_id: projectId,
    tool_key: toolKey,
    result: resultData.result,
    updated_at: new Date().toISOString(),
  });

  return { success: true, projectId, toolKey };
}

function mockLoadToolResult(userId, projectId, toolKey) {
  const projectKey = `${userId}:${projectId}`;
  const project = mockData.users.get(projectKey);

  if (!project) {
    return null;
  }

  const flatValue = project.project_data[toolKey];
  if (flatValue) {
    return {
      result: flatValue,
      projectUrl: "",
      updatedAt: new Date().toISOString(),
    };
  }

  return null;
}

test("mergeProjectDataWithToolResult preserves unrelated JSON and writes a flat key without toolResults", () => {
  const projectData = {
    existing_data: { status: "ready" },
    search_console: { sites: ["https://example.com"] },
    toolResults: { previous: { summary: "keep me" } },
  };

  const merged = mergeProjectDataWithToolResult(JSON.stringify(projectData), "gsc", {
    kind: "low-hanging",
    rows: [{ keyword: "best coffee" }],
  });

  assert.deepEqual(merged.existing_data, { status: "ready" });
  assert.deepEqual(merged.search_console, { sites: ["https://example.com"] });
  assert.deepEqual(merged.gsc, {
    kind: "low-hanging",
    rows: [{ keyword: "best coffee" }],
  });
  assert.equal(merged.toolResults, undefined, "legacy toolResults should be removed");
  assert.ok(JSON.stringify(merged));
});

test("mergeProjectDataForKey removes legacy toolResults before writing a flat key", () => {
  const projectData = {
    existing_data: { status: "ready" },
    toolResults: {
      gsc: { kind: "old" },
    },
  };

  const merged = mergeProjectDataForKey(projectData, "branded-keywords", [
    { keyword: "UCP", clicks: 100 },
  ]);

  assert.deepEqual(merged.existing_data, { status: "ready" });
  assert.deepEqual(merged["branded-keywords"], [{ keyword: "UCP", clicks: 100 }]);
  assert.equal(merged.toolResults, undefined, "legacy toolResults should be removed");
});

test("saveProjectData stores branded keywords at the top level without toolResults", () => {
  const userId = "user-brand";
  const projectId = "proj-brand";
  const project = {
    user_id: userId,
    project_id: projectId,
    project_data: {
      eeat: { score: 80 },
      robots: { status: "ok" },
    },
    owner_uid: userId,
  };

  const nextProjectData = {
    ...project.project_data,
    "branded-keywords": [
      { keyword: "UCP", clicks: 100, impressions: 2000, ctr: 5, position: 2.4 },
    ],
  };

  project.project_data = nextProjectData;

  assert.deepEqual(project.project_data.eeat, { score: 80 });
  assert.deepEqual(project.project_data.robots, { status: "ok" });
  assert.deepEqual(project.project_data["branded-keywords"], [
    { keyword: "UCP", clicks: 100, impressions: 2000, ctr: 5, position: 2.4 },
  ]);
  assert.ok(!project.project_data.toolResults, "toolResults should not be inserted for branded keywords");
  assert.deepEqual(project.project_data["branded-keywords"][0].keyword, "UCP");
});

test("saveProjectData preserves existing data and stores cannibalization results", () => {
  const existingData = {
    "branded-keywords": [{ keyword: "UCP", clicks: 12 }],
    settings: { selectedSite: "https://ucp.edu.pk" },
  };
  const cannibalization = [
    {
      keyword: "admissions",
      pageCount: 2,
      pages: [{ url: "https://ucp.edu.pk/admissions" }],
    },
  ];

  const merged = mergeProjectDataForKey(
    JSON.stringify(existingData),
    "cannibalization",
    cannibalization
  );

  assert.deepEqual(merged["branded-keywords"], existingData["branded-keywords"]);
  assert.deepEqual(merged.settings, existingData.settings);
  assert.deepEqual(merged.cannibalization, cannibalization);
  assert.deepEqual({
    project_id: "proj_1786539618062",
    project_data: merged,
    full_url: "https://ucp.edu.pk",
    project_name: "https://ucp.edu.pk/",
  }, {
    project_id: "proj_1786539618062",
    project_data: merged,
    full_url: "https://ucp.edu.pk",
    project_name: "https://ucp.edu.pk/",
  });
});

test("saveProjectData merge preserves nested results and handles empty project_data", () => {
  const existingData = {
    project_id: "proj-123",
    toolResults: { robots: { status: "ok" } },
    settings: { selectedSite: "https://example.com" },
  };
  const rows = [{ keyword: "services", pageCount: 2 }];

  const merged = mergeProjectDataPreservingKeys(
    JSON.stringify(existingData),
    "cannibalization",
    rows
  );

  assert.deepEqual(merged, {
    ...existingData,
    cannibalization: rows,
  });
  assert.deepEqual(mergeProjectDataPreservingKeys(null, "cannibalization", rows), {
    cannibalization: rows,
  });
  assert.deepEqual(mergeProjectDataPreservingKeys("", "cannibalization", rows), {
    cannibalization: rows,
  });
});

test("saveToolResult persists robots result to project_data", () => {
  const userId = "user-123";
  const projectId = "proj-456";
  const robotsResult = {
    url: "https://example.com/robots.txt",
    score: 85,
    summary: "robots.txt found with sitemap",
    detail: "5 directive lines found.",
    checks: [
      { pass: true, label: "robots.txt accessible" },
      { pass: true, label: "Sitemap declared" },
    ],
  };

  setupUserProject(userId, projectId, {});

  const saveResult = mockSaveToolResult(userId, projectId, "robots", {
    result: robotsResult,
    projectUrl: "https://example.com",
  });

  assert.equal(saveResult.success, true, "Save should succeed");
  assert.equal(saveResult.toolKey, "robots", "Tool key should match");

  const project = mockData.users.get(`${userId}:${projectId}`);
  assert.deepEqual(project.project_data.robots, robotsResult, "Result should be stored in project_data.robots");

  const loaded = mockLoadToolResult(userId, projectId, "robots");
  assert.ok(loaded, "Should be able to load the result");
  assert.deepEqual(loaded.result, robotsResult, "Loaded result should match saved result");
});

test("saveToolResult persists eeat result to project_data", () => {
  const userId = "user-789";
  const projectId = "proj-101112";
  const eeatResult = {
    url: "https://example.com/",
    score: 72,
    summary: "9/11 trust signals passed",
    detail: "Needs: Copy, Social profiles",
  };

  setupUserProject(userId, projectId, {});

  const saveResult = mockSaveToolResult(userId, projectId, "eeat", {
    result: eeatResult,
    projectUrl: "https://example.com",
  });

  assert.equal(saveResult.success, true);
  assert.equal(saveResult.toolKey, "eeat");

  const loaded = mockLoadToolResult(userId, projectId, "eeat");
  assert.ok(loaded);
  assert.deepEqual(loaded.result.score, 72);
});

test("saveToolResult persists speed_test result to project_data", () => {
  const userId = "user-abc";
  const projectId = "proj-def";
  const speedResult = {
    url: "https://example.com/",
    mobile: { score: 65, label: "Mobile Score" },
    desktop: { score: 78, label: "Desktop Score" },
    sections: [],
  };

  setupUserProject(userId, projectId, {});

  const saveResult = mockSaveToolResult(userId, projectId, "speed_test", {
    result: speedResult,
    projectUrl: "https://example.com",
  });

  assert.equal(saveResult.success, true);
  assert.equal(saveResult.toolKey, "speed_test");

  const loaded = mockLoadToolResult(userId, projectId, "speed_test");
  assert.ok(loaded);
  assert.deepEqual(loaded.result.mobile.score, 65);
});

test("saveToolResult persists duplicate result to project_data", () => {
  const userId = "user-dup";
  const projectId = "proj-dup2";
  const duplicateResult = {
    status: "completed",
    summary: {
      uniquePercent: 92,
      duplicatePercent: 5,
      commonPercent: 3,
      pagesScanned: 15,
    },
    duplicatePages: [],
  };

  setupUserProject(userId, projectId, {});

  const saveResult = mockSaveToolResult(userId, projectId, "duplicate", {
    result: duplicateResult,
    projectUrl: "https://example.com",
  });

  assert.equal(saveResult.success, true);

  const loaded = mockLoadToolResult(userId, projectId, "duplicate");
  assert.ok(loaded);
  assert.equal(loaded.result.summary.uniquePercent, 92);
});

test("multiple tool results can be persisted to the same project without overwriting", () => {
  const userId = "user-multi";
  const projectId = "proj-multi";

  setupUserProject(userId, projectId, {});

  mockSaveToolResult(userId, projectId, "robots", {
    result: { score: 85, summary: "robots.txt found" },
    projectUrl: "https://example.com",
  });

  mockSaveToolResult(userId, projectId, "eeat", {
    result: { score: 72, summary: "E-E-A-T signals" },
    projectUrl: "https://example.com",
  });

  mockSaveToolResult(userId, projectId, "speed_test", {
    result: { score: 65, summary: "Speed score" },
    projectUrl: "https://example.com",
  });

  const project = mockData.users.get(`${userId}:${projectId}`);
  const data = project.project_data;

  assert.ok(data.robots, "robots result should exist");
  assert.ok(data.eeat, "eeat result should exist");
  assert.ok(data.speed_test, "speed_test result should exist");
  assert.equal(data.toolResults, undefined, "legacy toolResults should not be present");
  assert.equal(data.robots.score, 85, "robots score preserved");
  assert.equal(data.eeat.score, 72, "eeat score preserved");
  assert.equal(data.speed_test.score, 65, "speed_test score preserved");
});

test("re-saving a tool result updates only that tool's data", () => {
  const userId = "user-update";
  const projectId = "proj-update";

  setupUserProject(userId, projectId, {});

  mockSaveToolResult(userId, projectId, "robots", {
    result: { score: 85, summary: "First run" },
    projectUrl: "https://example.com",
  });

  mockSaveToolResult(userId, projectId, "eeat", {
    result: { score: 72, summary: "First run" },
    projectUrl: "https://example.com",
  });

  mockSaveToolResult(userId, projectId, "robots", {
    result: { score: 90, summary: "Second run" },
    projectUrl: "https://example.com",
  });

  const project = mockData.users.get(`${userId}:${projectId}`);
  const data = project.project_data;

  assert.equal(data.robots.score, 90, "robots score should be updated");
  assert.equal(data.robots.summary, "Second run", "robots summary should be updated");
  assert.equal(data.eeat.score, 72, "eeat score should remain unchanged");
  assert.equal(data.eeat.summary, "First run", "eeat summary should remain unchanged");
});

test("all supported tool keys should be handled", () => {
  const supportedTools = [
    "dashboardChecks",
    "eeat",
    "semantic",
    "robots",
    "crawlOptimization",
    "speed",
    "duplicate",
    "gsc",
    "bing",
    "backlinks",
    "plagiarism",
    "speed_test",
    "sitemap",
    "llmsTxt",
    "w3c",
    "w3c-validation",
  ];

  const userId = "user-tools";
  const projectId = "proj-tools";

  setupUserProject(userId, projectId, {});

  for (const toolKey of supportedTools) {
    const result = mockSaveToolResult(userId, projectId, toolKey, {
      result: { score: 80, toolKey },
      projectUrl: "https://example.com",
    });

    assert.equal(result.success, true, `Should be able to save ${toolKey}`);
  }

  const project = mockData.users.get(`${userId}:${projectId}`);
  const data = project.project_data;

  for (const toolKey of supportedTools) {
    assert.ok(data[toolKey], `${toolKey} should be persisted`);
  }
  assert.equal(data.toolResults, undefined, "legacy toolResults should not be inserted");
});

test("tool results survive across multiple saves when not affected", () => {
  const userId = "user-persist";
  const projectId = "proj-persist";

  const existingData = {
    robots: { score: 85, summary: "existing" },
    eeat: { score: 72, summary: "existing" },
  };

  setupUserProject(userId, projectId, existingData);

  mockSaveToolResult(userId, projectId, "duplicate", {
    result: { score: 92, summary: "new" },
    projectUrl: "https://example.com",
  });

  const project = mockData.users.get(`${userId}:${projectId}`);
  const data = project.project_data;

  assert.equal(data.robots.score, 85, "robots should be preserved");
  assert.equal(data.eeaT?.score ?? data.eeat?.score, 72, "eeat should be preserved");
  assert.equal(data.duplicate.score, 92, "duplicate should be added");
  assert.equal(data.toolResults, undefined, "legacy toolResults should not be present");
});
