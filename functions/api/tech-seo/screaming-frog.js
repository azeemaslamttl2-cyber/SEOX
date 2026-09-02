import { analyzeScreamingFrog, buildScreamingFrogData, parseScreamingFrogCsv } from "../../../src/lib/screamingFrogAnalyzer.js";
import { configureMysqlConnection, queryOne } from "../../_lib/mysql.js";
import { fetchPublicHttpUrl, parsePublicHttpUrl } from "../../_lib/url-security.js";
import { parseCrawlText } from "../../_handlers/crawler-fetch.js";
import { unzipSync } from "fflate";
import { buildScreamingFrogPdfModel } from "../../../src/semanticsx/lib/toolPdfReports.js";
import { createProfessionalPdfReport } from "../../../src/semanticsx/lib/professionalPdfReport.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 200;
const MAX_EXTRACTED_BYTES = 200 * 1024 * 1024;
const MAX_CSV_BYTES = 25 * 1024 * 1024;
const MAX_TOKEN_LENGTH = 512;
const MAX_URLS = 10000;
const DEFAULT_MAX_PAGES = 100;
const MAX_CRAWL_PAGES = 500;
const DEFAULT_CRAWL_DEPTH = 3;
const MAX_CRAWL_DEPTH = 10;

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function failure(message, status, details = []) {
  return json({
    status: "error",
    success: false,
    message,
    total_urls_submitted: 0,
    total_urls_processed: 0,
    processed_urls: [],
    analysis_results: {},
    errors: details,
  }, status);
}

function validToken(value) {
  const token = typeof value === "string" ? value.trim() : "";
  if (!token) throw Object.assign(new Error("admin_token is required"), { status: 400 });
  if (token.length > MAX_TOKEN_LENGTH) throw Object.assign(new Error("admin_token is too long"), { status: 400 });
  return token;
}

async function verifyToken(token, env) {
  const configuredToken = String(env?.ADMIN_TOKEN || "").trim();
  if (configuredToken) {
    if (token !== configuredToken) throw Object.assign(new Error("Invalid admin token"), { status: 401 });
    const username = safeStorageName(env?.ADMIN_UPLOAD_USERNAME || 'admin');
    return { id: 'configured-admin', username, displayName: username };
  }
  configureMysqlConnection(env);
  let admin;
  try {
    admin = await queryOne(
      `SELECT id, username, display_name, email FROM users WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1`,
      [token]
    );
  } catch (cause) {
    if (cause?.code !== 'ER_BAD_FIELD_ERROR') throw cause;
    admin = await queryOne(
      `SELECT id, display_name, email FROM users WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1`,
      [token]
    );
  }
  if (!admin) throw Object.assign(new Error("Invalid admin token"), { status: 401 });
  const username = safeStorageName(admin.username || admin.display_name || String(admin.email || '').split('@')[0] || `user-${admin.id}`);
  return { id: String(admin.id), username, displayName: admin.display_name || username };
}

export function safeStorageName(value) {
  const name = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return name.slice(0, 80) || 'user';
}

export async function loadUploadStorage(env) {
  try {
    const [{ mkdir, writeFile, rm }, pathModule, processModule] = await Promise.all([
      import('node:fs/promises'), import('node:path'), import('node:process'),
    ]);
    const path = pathModule.default || pathModule;
    const process = processModule.default || processModule;
    const root = path.resolve(String(env?.UPLOAD_FILES_ROOT || path.join(process.cwd(), 'upload_files')));
    return { mkdir, writeFile, rm, path, root };
  } catch (cause) {
    throw Object.assign(new Error('Persistent ZIP upload storage is unavailable in this runtime.'), { status: 503, cause });
  }
}

export function safeChildPath(path, parent, child) {
  const target = path.resolve(parent, ...String(child).split('/'));
  const relative = path.relative(parent, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Object.assign(new Error('ZIP archive contains an unsafe file path'), { status: 422 });
  return target;
}

async function createUniqueDirectory(storage, parent, prefix) {
  for (let index = 1; index <= 10000; index += 1) {
    const directory = safeChildPath(storage.path, parent, `${prefix}-${index}`);
    try {
      await storage.mkdir(directory, { recursive: false });
      return { directory, index };
    } catch (cause) {
      if (cause?.code !== 'EEXIST') throw cause;
    }
  }
  throw Object.assign(new Error('Unable to allocate a unique ZIP extraction folder'), { status: 500 });
}

async function saveOriginalZip(storage, userDirectory, buffer) {
  const stamp = new Date().toISOString().slice(0, 10);
  for (let index = 0; index <= 10000; index += 1) {
    const suffix = index ? `-${index}` : '';
    const filename = `screaming-frog-${stamp}${suffix}.zip`;
    const target = safeChildPath(storage.path, userDirectory, filename);
    try {
      await storage.writeFile(target, buffer, { flag: 'wx' });
      return { filename, path: target };
    } catch (cause) {
      if (cause?.code !== 'EEXIST') throw cause;
    }
  }
  throw Object.assign(new Error('Unable to allocate a unique ZIP filename'), { status: 500 });
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

const CHECKLIST_CATEGORIES = [
  ['Indexation Issues Checklist', [['directory_pages', 'Directory Pages'], ['post_tags', 'Post Tags'], ['media_attachments', 'Media Attachments'], ['authors', 'Authors'], ['thin_empty', 'Thin or Empty Pages'], ['parameters', 'Parameters'], ['category_pages', 'Category Pages'], ['pdf_pages', 'PDF Pages'], ['search_result', 'Search Result Pages']]],
  ['WooCommerce Issues Checklist', [['product_tags', 'Product Tags (WooCommerce)'], ['account_pages', 'Account Pages']]],
  ['URL Issues Checklist', [['redirect_301_internal', '301 Redirects (Internal)'], ['redirect_404_internal', '404 Redirects (Internal)'], ['uppercase_urls', 'Upper Case Urls'], ['underscore_urls', 'Under Score Urls'], ['over_115_chars', 'Over 115 Characters'], ['redirect_301_external', '301 Redirects (External)'], ['redirect_404_external', '404 Redirects (External)'], ['params_internal', "Make Sure Parameters aren't used in Internal Links"], ['trailing_issues', 'Look for Trailing Internal Linking Issues'], ['non_trailing_issues', 'Look for Non Trailing Internal Linking Issues'], ['spammy_comments', 'Make Sure No Spammy Comments are Approved'], ['low_quality_links', "Make Sure the website doesn't Link to Low Quality Websites"], ['redirect_chains', 'Check for Redirect Chains']]],
  ['Page Titles Checklist', [['title_missing', 'Missing'], ['title_duplicate', 'Duplicate'], ['title_over_60', 'Over 60 Characters'], ['title_below_30', 'Below 30 Characters'], ['title_multiple', 'Multiple'], ['title_branding', 'Extract Titles into sheet and look for inconsistent Title Tag Branding'], ['title_over_optimized', 'Extract and Check for Over Optimized Title Tags'], ['title_headings_compare', 'Compare Titles and Headings']]],
  ['Meta Description Checklist', [['meta_missing', 'Missing'], ['meta_duplicate', 'Duplicate'], ['meta_over_155', 'Over 155 Characters'], ['meta_below_70', 'Below 70 Characters'], ['meta_multiple', 'Multiple']]],
  ['Heading 1 Checklist', [['h1_missing', 'Missing'], ['h1_duplicate', 'Duplicate'], ['h1_over_70', 'Over 70 Characters'], ['h1_multiple', 'Multiple']]],
  ['Images Checklist', [['images_over_100kb', 'Over 100 KB'], ['images_missing_alt', 'Missing Alt Text'], ['images_alt_over_100', 'Alt Over 100 Words'], ['images_seo_optimized', 'Are Images Urls SEO Optimized?']]],
  ['Canonicals Checklist', [['canonical_canonicalized', 'Canonicalized'], ['canonical_missing', 'Missing'], ['canonical_multiple', 'Multiple'], ['canonical_non_indexable', 'Non Indexable']]],
  ['Structured Data Checklist', [['schema_errors', 'Errors'], ['schema_missing', 'Missing']]],
];
const PDF_CHECKLIST_CATEGORIES = CHECKLIST_CATEGORIES.map(([name, items]) => ({
  name,
  items: items.map(([id, label]) => ({ id, name: label })),
}));

function createCsvReport(data) {
  // Deliberately matches the frontend CSV exporter: same category sequence,
  // labels, count column, and unchecked status for a fresh server report.
  const rows = [['Website Audit Checklist', '', '', ''], ['', '', '', '']];
  CHECKLIST_CATEGORIES.forEach(([name, items]) => {
    rows.push([name, '', 'Issues', 'Status']);
    items.forEach(([id, label]) => {
      rows.push([label, '', data.issues[id]?.count || '', 'Not Checked']);
    });
    rows.push(['', '', '', '']);
  });
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function createPdfReport(data) {
  // Uses the same shared professional PDF model and renderer as the frontend
  // `downloadScreamingFrogPdf` action. The server simply writes its bytes.
  const model = buildScreamingFrogPdfModel({
    analysisResults: data.issues,
    categories: PDF_CHECKLIST_CATEGORIES,
    checkedItems: {},
    user: null,
  });
  const report = createProfessionalPdfReport(model);
  return Buffer.from(report.doc.output('arraybuffer'));
}

async function createUniqueReportFiles(storage, userDirectory, data) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (let index = 1; index <= 10000; index += 1) {
    const id = `${date}-${String(index).padStart(3, '0')}`;
    const csvFilename = `screaming-frog-report-${id}.csv`;
    const pdfFilename = `screaming-frog-report-${id}.pdf`;
    try {
      await storage.writeFile(safeChildPath(storage.path, userDirectory, csvFilename), createCsvReport(data), { flag: 'wx' });
      try {
        await storage.writeFile(safeChildPath(storage.path, userDirectory, pdfFilename), createPdfReport(data), { flag: 'wx' });
      } catch (cause) {
        await storage.rm(safeChildPath(storage.path, userDirectory, csvFilename), { force: true }).catch(() => {});
        throw cause;
      }
      return { csvFilename, pdfFilename };
    } catch (cause) {
      if (cause?.code !== 'EEXIST') throw cause;
    }
  }
  throw Object.assign(new Error('Unable to allocate unique report filenames'), { status: 500 });
}

function reportDownloadSecret(env) {
  const secret = String(env?.REPORT_DOWNLOAD_SECRET || env?.ADMIN_TOKEN || env?.AUTH_JWT_SECRET || '');
  if (!secret) throw Object.assign(new Error('REPORT_DOWNLOAD_SECRET must be configured to create report download links'), { status: 503 });
  return secret;
}

async function reportSignature(filename, expires, env) {
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', reportDownloadSecret(env)).update(`${filename}:${expires}`).digest('hex');
}

export async function createReportDownloadUrl(origin, filename, env) {
  const expires = Date.now() + (15 * 60 * 1000);
  const signature = await reportSignature(filename, expires, env);
  const url = new URL('/api/tech-seo/screaming-frog/report-download', origin);
  url.searchParams.set('file', filename);
  url.searchParams.set('expires', String(expires));
  url.searchParams.set('signature', signature);
  return url.toString();
}

export async function verifyReportDownloadUrl(filename, expires, signature, env) {
  if (!/^screaming-frog-report-\d{8}-\d{3,}\.(?:csv|pdf)$/.test(String(filename))) return false;
  const expiry = Number(expires);
  if (!Number.isSafeInteger(expiry) || expiry < Date.now()) return false;
  const expected = await reportSignature(filename, expiry, env);
  if (expected.length !== String(signature).length) return false;
  const { timingSafeEqual } = await import('node:crypto');
  return timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
}

async function readBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (file && typeof file !== "string") {
      if (file.size > MAX_ZIP_BYTES) {
        throw Object.assign(new Error(`file must be ${MAX_ZIP_BYTES / 1024 / 1024} MB or smaller`), { status: 413 });
      }
      return { adminToken: form.get("admin_token"), zip: Buffer.from(await file.arrayBuffer()), fileName: file.name || "upload.zip" };
    }
    const input = form.get("urls_csv");
    if (input && typeof input !== "string") {
      if (input.size > MAX_FILE_BYTES) throw Object.assign(new Error("urls_csv must be 10 MB or smaller"), { status: 413 });
      return { adminToken: form.get("admin_token"), csv: await input.text() };
    }
    return { adminToken: form.get("admin_token"), csv: typeof input === "string" ? input : "" };
  }
  const body = await request.json().catch(() => null);
  return {
    adminToken: body?.admin_token,
    csv: body?.urls_csv,
    url: body?.url,
    options: body?.options || {},
  };
}

function hasZipSignature(buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b &&
    ([0x03, 0x05, 0x07].includes(buffer[2])) && ([0x04, 0x06, 0x08].includes(buffer[3]));
}

function normalizeZipPath(path) {
  const value = String(path || "").replace(/\\/g, "/");
  if (!value) return { path: "", isDirectory: true };
  if (value.startsWith("/") || /^[a-zA-Z]:\//.test(value)) return null;

  const parts = value.split("/").filter((part) => part && part !== ".");
  if (parts.includes("..")) return null;
  if (!parts.length) return { path: "", isDirectory: true };
  return { path: parts.join("/"), isDirectory: /\/$/.test(value) };
}

function decodeCsvBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  const decode = (encoding) => new TextDecoder(encoding).decode(bytes).replace(/^\uFEFF/, '');
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: decode('utf-16le'), encoding: 'utf-16le' };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: decode('utf-16be'), encoding: 'utf-16be' };
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { text: decode('utf-8'), encoding: 'utf-8-bom' };
  // A UTF-16 file without a BOM is still common in spreadsheet exports.
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  let evenNuls = 0; let oddNuls = 0;
  for (let index = 0; index < sample.length; index += 1) {
    if (sample[index] === 0) {
      if (index % 2) oddNuls += 1;
      else evenNuls += 1;
    }
  }
  if (oddNuls > sample.length / 8) return { text: decode('utf-16le'), encoding: 'utf-16le (heuristic)' };
  if (evenNuls > sample.length / 8) return { text: decode('utf-16be'), encoding: 'utf-16be (heuristic)' };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, ''), encoding: 'utf-8' };
  } catch {
    return { text: decode('windows-1252'), encoding: 'windows-1252' };
  }
}

async function processZip(buffer, extraction = null) {
  if (!hasZipSignature(buffer)) {
    throw Object.assign(new Error("file must be a valid ZIP archive"), { status: 422 });
  }

  let entries;
  try {
    entries = unzipSync(buffer);
  } catch {
    throw Object.assign(new Error("Unable to read the uploaded ZIP archive"), { status: 422 });
  }
  const entryList = Object.entries(entries);
  if (entryList.length > MAX_ZIP_ENTRIES) {
    throw Object.assign(new Error(`ZIP archive contains more than ${MAX_ZIP_ENTRIES} files`), { status: 413 });
  }

  const data = {};
  const files = [];
  const diagnostics = [];
  let extractedBytes = 0;
  let csvFilesFound = 0;
  for (const [entryPath, entryData] of entryList) {
    const normalizedEntry = normalizeZipPath(entryPath);
    if (!normalizedEntry) {
      throw Object.assign(new Error("ZIP archive contains an unsafe file path"), {
        status: 422,
        details: [{ type: "unsafe_path", entry: String(entryPath).slice(0, 512) }],
      });
    }
    if (normalizedEntry.isDirectory) continue;
    if (!normalizedEntry.path.toLowerCase().endsWith(".csv")) {
      diagnostics.push({ name: normalizedEntry.path, status: 'ignored', reason: 'Not a CSV file' });
      continue;
    }
    csvFilesFound += 1;
    if (entryData.length > MAX_CSV_BYTES || extractedBytes + entryData.length > MAX_EXTRACTED_BYTES) {
      throw Object.assign(new Error("ZIP archive contains CSV data above the allowed extraction limit"), { status: 413 });
    }
    const csvBuffer = Buffer.from(entryData);
    extractedBytes += csvBuffer.length;
    if (csvBuffer.length > MAX_CSV_BYTES || extractedBytes > MAX_EXTRACTED_BYTES) {
      throw Object.assign(new Error("ZIP archive expands beyond the allowed extraction limit"), { status: 413 });
    }
    if (extraction) {
      const target = safeChildPath(extraction.storage.path, extraction.directory, normalizedEntry.path);
      await extraction.storage.mkdir(extraction.storage.path.dirname(target), { recursive: true });
      await extraction.storage.writeFile(target, csvBuffer, { flag: 'wx' });
    }
    const { text: csv, encoding } = decodeCsvBuffer(csvBuffer);
    const parsed = parseScreamingFrogCsv(csv);
    if (!parsed.headers.length || !parsed.rows.length) {
      diagnostics.push({
        name: normalizedEntry.path,
        status: 'failed',
        reason: !csv.trim() ? 'CSV file is empty' : 'CSV headers or data rows could not be parsed',
        bytes: csvBuffer.length,
        encoding,
      });
      continue;
    }
    if (!parsed.hasRecognizedHeader) {
      diagnostics.push({
        name: normalizedEntry.path,
        status: 'ignored',
        reason: 'CSV does not contain recognized Screaming Frog headers',
        bytes: csvBuffer.length,
        encoding,
      });
      continue;
    }
    const mapped = buildScreamingFrogData(csv);
    const category = Object.keys(mapped)[0];
    if (!category) {
      diagnostics.push({ name: normalizedEntry.path, status: 'ignored', reason: 'CSV is not a supported Screaming Frog export', bytes: csvBuffer.length, encoding });
      continue;
    }
    if (!data[category]) data[category] = { headers: mapped[category].headers, rows: [], urls: [] };
    data[category].rows.push(...mapped[category].rows);
    data[category].urls.push(...mapped[category].urls);
    const file = { name: normalizedEntry.path, category, rows: parsed.rows.length, bytes: csvBuffer.length, encoding, status: 'processed' };
    files.push(file);
    diagnostics.push(file);
  }

  if (!files.length) {
    throw Object.assign(new Error("No valid CSV files with usable data were found in the ZIP archive."), {
      status: 422,
      details: {
        total_files_found: entryList.length,
        csv_files_found: csvFilesFound,
        csv_files_processed: 0,
        files: diagnostics,
      },
    });
  }
  const analysis = analyzeScreamingFrog(data);
  const totalUrls = Object.values(data).reduce((total, category) => total + category.rows.length, 0);
  return {
    summary: { totalFiles: entryList.length, csvFilesFound, processedFiles: files.length, totalUrls },
    files,
    diagnostics,
    categories: data,
    issues: analysis,
  };
}

async function persistAndProcessZip(buffer, owner, env, origin) {
  if (!hasZipSignature(buffer)) {
    throw Object.assign(new Error("file must be a valid ZIP archive"), { status: 422 });
  }
  const storage = await loadUploadStorage(env);
  const userDirectory = safeChildPath(storage.path, storage.root, owner.username);
  await storage.mkdir(userDirectory, { recursive: true });
  const originalZip = await saveOriginalZip(storage, userDirectory, buffer);
  const extraction = await createUniqueDirectory(storage, userDirectory, `${owner.username}-zip`);
  try {
    const data = await processZip(buffer, { storage, directory: extraction.directory });
    const reportDirectory = safeChildPath(storage.path, storage.root, 'admin');
    await storage.mkdir(reportDirectory, { recursive: true });
    const reports = await createUniqueReportFiles(storage, reportDirectory, data);
    return {
      ...data,
      upload: {
        username: owner.username,
        zip_file: originalZip.filename,
        extraction_folder: storage.path.basename(extraction.directory),
      },
      reports: {
        csv: { filename: reports.csvFilename, download_url: await createReportDownloadUrl(origin, reports.csvFilename, env) },
        pdf: { filename: reports.pdfFilename, download_url: await createReportDownloadUrl(origin, reports.pdfFilename, env) },
      },
    };
  } catch (cause) {
    // The source ZIP is intentionally retained for audit/retry purposes; only
    // the incomplete extraction directory is temporary and is removed.
    await storage.rm(extraction.directory, { recursive: true, force: true }).catch(() => {});
    throw cause;
  }
}

function normalizeCrawlOptions(options = {}) {
  const maxPages = Number(options.maxPages ?? DEFAULT_MAX_PAGES);
  const crawlDepth = Number(options.crawlDepth ?? DEFAULT_CRAWL_DEPTH);
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > MAX_CRAWL_PAGES) {
    throw Object.assign(new Error(`options.maxPages must be an integer from 1 to ${MAX_CRAWL_PAGES}`), { status: 422 });
  }
  if (!Number.isInteger(crawlDepth) || crawlDepth < 0 || crawlDepth > MAX_CRAWL_DEPTH) {
    throw Object.assign(new Error(`options.crawlDepth must be an integer from 0 to ${MAX_CRAWL_DEPTH}`), { status: 422 });
  }
  return { maxPages, crawlDepth };
}

function absoluteUrl(value, baseUrl) {
  try {
    const url = new URL(String(value), baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function inScope(value, root) {
  try {
    const hostname = new URL(value).hostname.replace(/^www\./i, '');
    return hostname === root.hostname.replace(/^www\./i, '');
  } catch {
    return false;
  }
}

function crawlRow(result) {
  const audit = result.audit || {};
  return {
    Address: result.finalUrl || result.url,
    'Status Code': result.status,
    Indexability: audit.noindex ? 'Non-Indexable' : 'Indexable',
    'Title 1': audit.titleText || '',
    'Title 1 Length': audit.titleLength || 0,
    'Title 2': audit.titleCount > 1 ? '(multiple)' : '',
    'Meta Description 1': audit.metaDescriptionText || '',
    'Meta Description 1 Length': audit.metaDescriptionLength || 0,
    'Meta Description 2': audit.metaDescriptionCount > 1 ? '(multiple)' : '',
    'H1-1': audit.h1Text || '',
    'H1-2': audit.h1Count > 1 ? '(multiple)' : '',
    'Canonical Link Element 1': audit.canonicalUrl || '',
    'Word Count': audit.wordCount || 0,
    'Content Type': result.contentType || '',
    'Redirect URL': result.redirectedTo || '',
    'Robots Meta': audit.robotsMeta || '',
  };
}

function linkRows(records, root) {
  return records.flatMap((record) => (record.links || []).map((link) => {
    const url = typeof link === 'string' ? link : link.url;
    return {
      sourceUrl: record.url,
      targetUrl: url,
      linkType: inScope(url, root) ? 'internal' : 'external',
      anchor: typeof link === 'string' ? '' : link.anchor || '',
      nofollow: typeof link === 'string' ? false : Boolean(link.nofollow),
    };
  }));
}

async function crawlWebsite(startUrl, options) {
  const root = parsePublicHttpUrl(startUrl);
  const startedAt = Date.now();
  const queue = [{ url: root.toString(), depth: 0 }];
  const queued = new Set(queue.map((item) => item.url));
  const records = [];
  const crawlErrors = [];

  while (queue.length && records.length < options.maxPages) {
    const current = queue.shift();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const response = await fetchPublicHttpUrl(current.url, {
        maxRedirects: 0,
        signal: controller.signal,
        headers: {
          'user-agent': 'SEOXBot/1.0 (+https://seox.local/crawler; compatible; screaming-frog-api)',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
        },
      }).finally(() => clearTimeout(timeout));
      const contentType = response.headers.get('content-type') || 'unknown';
      const bytes = Buffer.from(await response.arrayBuffer());
      const finalUrl = response.url || current.url;
      const parsed = parseCrawlText(
        contentType.toLowerCase().includes('text/') || contentType.toLowerCase().includes('html') || contentType.toLowerCase().includes('xml')
          ? bytes.toString('utf8').slice(0, 2_000_000)
          : '',
        contentType,
        finalUrl,
      );
      const redirectedTo = response.headers.get('location') ? absoluteUrl(response.headers.get('location'), finalUrl) : '';
      const record = {
        url: current.url,
        finalUrl,
        depth: current.depth,
        status: response.status,
        contentType,
        sizeBytes: bytes.length,
        loadTimeMs: 0,
        redirectedTo: redirectedTo || null,
        xRobotsTag: response.headers.get('x-robots-tag') || '',
        links: parsed.links || [],
        resources: parsed.resources || [],
        audit: parsed.audit || {},
      };
      records.push(record);

      if (current.depth < options.crawlDepth && contentType.toLowerCase().includes('html')) {
        for (const link of record.links) {
          const discovered = absoluteUrl(typeof link === 'string' ? link : link.url, finalUrl);
          if (discovered && inScope(discovered, root) && !queued.has(discovered)) {
            queued.add(discovered);
            queue.push({ url: discovered, depth: current.depth + 1 });
          }
        }
      }
    } catch (error) {
      crawlErrors.push({ url: current.url, message: error?.message || 'Crawl request failed' });
      records.push({ url: current.url, finalUrl: current.url, depth: current.depth, status: 0, contentType: 'error', sizeBytes: 0, links: [], resources: [], audit: {} });
    }
  }

  const rootHost = root.hostname;
  const links = linkRows(records, root);
  const internalTargets = new Map(records.map((record) => [record.finalUrl, record.status]));
  const brokenLinks = links.filter((link) => link.linkType === 'internal' && internalTargets.has(link.targetUrl) && (internalTargets.get(link.targetUrl) < 200 || internalTargets.get(link.targetUrl) >= 400));
  const rows = records.map(crawlRow);
  const analysis = analyzeScreamingFrog({ internal_html: { rows } });
  const counts = records.reduce((summary, record) => {
    if (record.status >= 200 && record.status < 300) summary.successfulUrls += 1;
    else if (record.status >= 300 && record.status < 400) summary.redirects += 1;
    else if (record.status >= 400 && record.status < 500) summary.clientErrors += 1;
    else if (record.status >= 500 || record.status === 0) summary.serverErrors += 1;
    return summary;
  }, { totalUrls: records.length, successfulUrls: 0, redirects: 0, clientErrors: 0, serverErrors: 0 });

  return {
    summary: { ...counts, discoveredUrls: queued.size, brokenLinks: brokenLinks.length },
    urls: records,
    links,
    brokenLinks,
    issues: analysis,
    errors: crawlErrors,
    metadata: { crawlDurationMs: Date.now() - startedAt, pagesCrawled: records.length, maxPages: options.maxPages, crawlDepth: options.crawlDepth, host: rootHost },
  };
}

function urlError(value) {
  try {
    const parsed = new URL(String(value).trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
    return null;
  } catch {
    return "URL must be an absolute http or https URL";
  }
}

function prepareInput(csv) {
  if (typeof csv !== "string" || !csv.trim()) throw Object.assign(new Error("urls_csv is required and must not be empty"), { status: 422 });
  const parsed = parseScreamingFrogCsv(csv);
  const submitted = parsed.urls.length;
  if (!submitted) throw Object.assign(new Error("No URLs were found in urls_csv"), { status: 422 });
  if (submitted > MAX_URLS) throw Object.assign(new Error(`urls_csv contains more than ${MAX_URLS} URLs`), { status: 413 });

  const errors = [];
  const validRows = parsed.rows.filter((row, index) => {
    const value = row.Address || row.URL || row["Source URL"] || "";
    const message = urlError(value);
    if (message) errors.push({ row: index + 2, value, message });
    return !message;
  });
  if (!validRows.length) throw Object.assign(new Error("No valid URLs were found in urls_csv"), {
    status: 422,
    details: errors,
    submitted,
  });

  const mapped = buildScreamingFrogData(csv);
  const category = Object.keys(mapped)[0] || 'internal_html';
  return {
    data: { [category]: { ...parsed, rows: validRows, urls: validRows.map((row) => row.Address || row.URL || row["Source URL"]) } },
    submitted,
    validRows,
    errors,
  };
}

function perUrlResults(urls, analysis) {
  return urls.map((url) => {
    const findings = Object.entries(analysis)
      .filter(([, result]) => result.urls.includes(url))
      .map(([check, result]) => ({ check, count: result.urls.filter((candidate) => candidate === url).length }));
    return { url, success: true, findings };
  });
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return failure("Method not allowed", 405);

  try {
    const input = await readBody(request);
    const token = validToken(input.adminToken);
    const owner = await verifyToken(token, env);
    if (input.zip) {
      const data = await persistAndProcessZip(input.zip, owner, env, new URL(request.url).origin);
      return json({ success: true, message: "Screaming Frog CSV files processed successfully", data });
    }
    if (input.url) {
      const requestedUrls = Array.isArray(input.url) ? input.url : [input.url];
      if (!requestedUrls.length || requestedUrls.length > 20) {
        throw Object.assign(new Error("url must contain between 1 and 20 URLs"), { status: 422 });
      }
      const options = normalizeCrawlOptions(input.options);
      const crawls = [];
      for (const requestedUrl of requestedUrls) {
        const parsedUrl = parsePublicHttpUrl(requestedUrl);
        crawls.push({ url: parsedUrl.toString(), ...(await crawlWebsite(parsedUrl.toString(), options)) });
      }

      if (crawls.length === 1) {
        return json({ success: true, message: 'SEO crawl completed successfully', data: crawls[0] });
      }

      const summary = crawls.reduce((total, crawl) => {
        Object.keys(total).forEach((key) => {
          total[key] += Number(crawl.summary[key] || 0);
        });
        return total;
      }, { totalUrls: 0, successfulUrls: 0, redirects: 0, clientErrors: 0, serverErrors: 0, discoveredUrls: 0, brokenLinks: 0 });
      return json({
        success: true,
        message: 'SEO crawls completed successfully',
        data: {
          summary,
          crawls,
          metadata: { domainsRequested: crawls.length, maxPagesPerDomain: options.maxPages, crawlDepth: options.crawlDepth },
        },
      });
    }
    const prepared = prepareInput(input.csv);
    const analysis = analyzeScreamingFrog(prepared.data);
    const processedUrls = prepared.validRows.map((row) => row.Address || row.URL || row["Source URL"]);
    return json({
      status: "success",
      success: true,
      message: prepared.errors.length ? "Analysis completed with URL validation errors" : "Analysis completed successfully",
      total_urls_submitted: prepared.submitted,
      total_urls_processed: processedUrls.length,
      processed_urls: processedUrls,
      analysis_results: analysis,
      results_by_url: perUrlResults(processedUrls, analysis),
      errors: prepared.errors,
    });
  } catch (caught) {
    const details = caught?.details;
    return json({
      status: "error",
      success: false,
      message: caught?.message || "Screaming Frog analysis failed",
      total_urls_submitted: caught?.submitted || 0,
      total_urls_processed: 0,
      processed_urls: [],
      analysis_results: {},
      ...(details && !Array.isArray(details) ? { details } : {}),
      errors: Array.isArray(details) ? details : [],
    }, caught?.status || 500);
  }
}
