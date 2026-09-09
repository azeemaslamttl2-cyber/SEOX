import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync, strToU8 } from "fflate";
import { onRequest } from "./screaming-frog.js";
import { onRequest as downloadReport } from "./screaming-frog/report-download.js";

const testUploadRoot = mkdtempSync(join(tmpdir(), "screaming-frog-upload-"));
const env = { ADMIN_TOKEN: "valid-admin-token", ADMIN_UPLOAD_USERNAME: "john", UPLOAD_FILES_ROOT: testUploadRoot };

test.after(() => rmSync(testUploadRoot, { recursive: true, force: true }));

function request(body) {
  return onRequest({
    request: new Request("https://example.com/api/tech-seo/screaming-frog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    env,
  });
}

test("Screaming Frog API analyzes a valid CSV URL list", async () => {
  const response = await request({
    admin_token: "valid-admin-token",
    urls_csv: "https://example.com/page-a,https://example.org/page-b",
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.status, "success");
  assert.equal(payload.total_urls_submitted, 2);
  assert.equal(payload.total_urls_processed, 2);
  assert.deepEqual(payload.processed_urls, ["https://example.com/page-a", "https://example.org/page-b"]);
  assert.equal(payload.results_by_url.length, 2);
  assert.ok(payload.analysis_results);
});

test("Screaming Frog API supports multiple rows and reports invalid URLs", async () => {
  const response = await request({
    admin_token: "valid-admin-token",
    urls_csv: "Address\nhttps://example.com/ok\nnot-a-url\nftp://example.com/nope",
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.total_urls_submitted, 3);
  assert.equal(payload.total_urls_processed, 1);
  assert.equal(payload.errors.length, 2);
  assert.equal(payload.processed_urls[0], "https://example.com/ok");
});

test("Screaming Frog API rejects empty CSV input", async () => {
  const response = await request({ admin_token: "valid-admin-token", urls_csv: "  " });
  const payload = await response.json();
  assert.equal(response.status, 422);
  assert.equal(payload.status, "error");
  assert.match(payload.message, /empty|required/i);
});

test("Screaming Frog API rejects missing admin token", async () => {
  const response = await request({ urls_csv: "https://example.com" });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.match(payload.message, /admin_token/i);
});

test("Screaming Frog API rejects invalid admin token before processing", async () => {
  const response = await request({ admin_token: "wrong-token", urls_csv: "https://example.com" });
  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.match(payload.message, /invalid admin token/i);
});

test("Screaming Frog API accepts a multipart CSV file", async () => {
  const form = new FormData();
  form.append("admin_token", "valid-admin-token");
  form.append("urls_csv", new Blob(["https://example.com/file-upload"]), "urls.csv");
  const response = await onRequest({
    request: new Request("https://example.com/api/tech-seo/screaming-frog", { method: "POST", body: form }),
    env,
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.total_urls_processed, 1);
  assert.deepEqual(payload.processed_urls, ["https://example.com/file-upload"]);
});

test("Screaming Frog API crawls a URL and returns structured JSON", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "https://example.com/") {
      return new Response(
        '<html><head><title>Home</title><meta name="description" content="A useful page"><link rel="canonical" href="https://example.com/"></head><body><h1>Home</h1><a href="/missing">Missing</a></body></html>',
        { status: 200, headers: { "content-type": "text/html" } },
      );
    }
    if (url === "https://example.com/missing") {
      return new Response("Not found", { status: 404, headers: { "content-type": "text/html" } });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  try {
    const response = await request({
      admin_token: "valid-admin-token",
      url: "https://example.com",
      options: { crawlDepth: 1, maxPages: 2 },
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.data.summary.totalUrls, 2);
    assert.equal(payload.data.summary.clientErrors, 1);
    assert.equal(payload.data.metadata.pagesCrawled, 2);
    assert.equal(payload.data.urls[0].audit.titleText, "Home");
    assert.equal(payload.data.links[0].linkType, "internal");
    assert.equal(payload.data.brokenLinks.length, 1);
    assert.equal(payload.data.issues.title_missing.count, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Screaming Frog API accepts multiple domains with the same url parameter", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => new Response(
    `<html><head><title>${String(input).includes("example.org") ? "Org" : "Com"}</title></head><body><h1>Page</h1></body></html>`,
    { status: 200, headers: { "content-type": "text/html" } },
  );

  try {
    const response = await request({
      admin_token: "valid-admin-token",
      url: ["https://example.com", "https://example.org"],
      options: { crawlDepth: 0, maxPages: 1 },
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.data.crawls.length, 2);
    assert.equal(payload.data.summary.totalUrls, 2);
    assert.deepEqual(payload.data.crawls.map((crawl) => crawl.url), [
      "https://example.com/",
      "https://example.org/",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Screaming Frog API rejects an invalid ZIP upload as JSON", async () => {
  const form = new FormData();
  form.append("admin_token", "valid-admin-token");
  form.append("file", new Blob(["not a zip"]), "export.zip");
  const response = await onRequest({
    request: new Request("https://example.com/api/tech-seo/screaming-frog", { method: "POST", body: form }),
    env,
  });
  const payload = await response.json();
  assert.equal(response.status, 422);
  assert.equal(payload.success, false);
  assert.match(payload.message, /valid ZIP/i);
});

test("Screaming Frog API extracts and analyzes CSV files from a ZIP", async () => {
  const archive = zipSync({
    "internal_html.csv": strToU8([
      "Address,Title 1,Meta Description 1,H1-1",
      "https://example.com/,Home,Useful description,Welcome",
      "https://example.com/about,,Short description,",
    ].join("\n")),
  });
  const form = new FormData();
  form.append("admin_token", "valid-admin-token");
  form.append("file", new Blob([archive], { type: "application/zip" }), "screaming-frog-export.zip");
  const response = await onRequest({
    request: new Request("https://example.com/api/tech-seo/screaming-frog", { method: "POST", body: form }),
    env,
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.summary.processedFiles, 1);
  assert.equal(payload.data.summary.totalUrls, 2);
  assert.equal(payload.data.files[0].category, "internal_html");
  assert.equal(payload.data.issues.title_missing.count, 1);
  assert.equal(payload.data.issues.h1_missing.count, 1);
  assert.equal(payload.data.upload.username, "john");
  assert.match(payload.data.upload.zip_file, /^screaming-frog-\d{4}-\d{2}-\d{2}\.zip$/);
  assert.equal(payload.data.upload.extraction_folder, "john-zip-1");
  assert.equal(
    readFileSync(join(testUploadRoot, "john", "john-zip-1", "internal_html.csv"), "utf8").includes("https://example.com/about"),
    true,
  );
  assert.match(payload.data.reports.csv.filename, /^screaming-frog-report-\d{8}-001\.csv$/);
  assert.match(payload.data.reports.pdf.filename, /^screaming-frog-report-\d{8}-001\.pdf$/);
  assert.equal(readFileSync(join(testUploadRoot, "admin", payload.data.reports.csv.filename), "utf8").includes("Website Audit Checklist"), true);
  assert.match(readFileSync(join(testUploadRoot, "admin", payload.data.reports.pdf.filename)).subarray(0, 8).toString(), /^%PDF-1\.[0-9]$/);

  const csvDownload = await downloadReport({ request: new Request(payload.data.reports.csv.download_url), env });
  assert.equal(csvDownload.status, 200);
  assert.match(csvDownload.headers.get("content-disposition"), /attachment/);
  assert.match(csvDownload.headers.get("content-type"), /text\/csv/);
  assert.equal((await csvDownload.text()).includes("Website Audit Checklist"), true);

  const pdfDownload = await downloadReport({ request: new Request(payload.data.reports.pdf.download_url), env });
  assert.equal(pdfDownload.status, 200);
  assert.match(pdfDownload.headers.get("content-type"), /application\/pdf/);
});

test("Screaming Frog API ignores non-CSV files inside a ZIP", async () => {
  const archive = zipSync({
    "internal_urls.csv": strToU8("Address\nhttps://example.com/"),
    "readme.txt": strToU8("unsupported"),
  });
  const form = new FormData();
  form.append("admin_token", "valid-admin-token");
  form.append("file", new Blob([archive], { type: "application/zip" }), "export.zip");
  const response = await onRequest({
    request: new Request("https://example.com/api/tech-seo/screaming-frog", { method: "POST", body: form }),
    env,
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.summary.processedFiles, 1);
  assert.equal(payload.data.upload.extraction_folder, "john-zip-2");
  assert.deepEqual(payload.data.diagnostics.find((file) => file.name === "readme.txt"), {
    name: "readme.txt", status: "ignored", reason: "Not a CSV file",
  });
});

test("Screaming Frog API detects uppercase, nested, BOM and semicolon CSV exports", async () => {
  const archive = zipSync({
    "Export/Internal URLs.CSV": strToU8("\uFEFFAddress;Title 1;Meta Description 1;H1-1\rhttps://example.com/;Home;Description;Heading\r"),
  });
  const form = new FormData();
  form.append("admin_token", "valid-admin-token");
  form.append("file", new Blob([archive], { type: "application/zip" }), "export.zip");
  const response = await onRequest({
    request: new Request("https://example.com/api/tech-seo/screaming-frog", { method: "POST", body: form }), env,
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.data.summary.csvFilesFound, 1);
  assert.equal(payload.data.files[0].name, "Export/Internal URLs.CSV");
  assert.equal(payload.data.summary.totalUrls, 1);
});

test("Screaming Frog API reports per-file diagnostics when ZIP CSV files are unusable", async () => {
  const archive = zipSync({ "folder/empty.CSV": strToU8("\uFEFF\r\n"), "notes.txt": strToU8("ignored") });
  const form = new FormData();
  form.append("admin_token", "valid-admin-token");
  form.append("file", new Blob([archive], { type: "application/zip" }), "export.zip");
  const response = await onRequest({
    request: new Request("https://example.com/api/tech-seo/screaming-frog", { method: "POST", body: form }), env,
  });
  const payload = await response.json();
  assert.equal(response.status, 422);
  assert.equal(payload.details.total_files_found, 2);
  assert.equal(payload.details.csv_files_found, 1);
  assert.equal(payload.details.files.find((file) => file.name === "folder/empty.CSV").reason, "CSV file is empty");
});
