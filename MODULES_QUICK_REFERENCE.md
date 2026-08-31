# Quick Reference: Modules Data Structure

## 14 Registered Tool Result Keys

All stored under `project_data.toolResults.{toolKey}`:

| # | Module | Key | Legacy Path | Source File |
|---|--------|-----|-------------|------------|
| 1 | Dashboard Checks | `dashboardChecks` | — | `src/pages/Dashboard.jsx` |
| 2 | E-E-A-T Audit | `eeat` | `$.eeat` | `src/pages/techseo/EeatAudit.jsx` |
| 3 | Semantic Audit | `semantic` | `$.semantic_audit` | `src/pages/techseo/SemanticAudit.jsx` |
| 4 | Robots.txt Analyzer | `robots` | `$.robots` | `src/pages/techseo/RobotsAnalyzer.jsx` |
| 5 | Speed Optimization | `speed` | `$.speed_test` | `src/pages/techseo/SpeedOptimization.jsx` |
| 6 | Duplicate Checker | `duplicate` | `$.duplicate` | `src/pages/techseo/DuplicateChecker.jsx` |
| 7 | GSC Audit | `gsc` | — | `src/pages/techseo/GscAudit.jsx` |
| 8 | Bing Webmaster | `bing` | — | `src/pages/techseo/BingWebmaster.jsx` |
| 9 | Backlinks Audit | `backlinks` | `$.backlinks_audit` | `src/pages/techseo/BacklinksAudit.jsx` |
| 10 | Plagiarism Checker | `plagiarism` | — | `src/pages/techseo/PlagiarismChecker.jsx` |
| 11 | Crawl Optimization | `crawlOptimization` | `$.crawl_optimization` | `src/pages/techseo/CrawlOptimization.jsx` |
| 12 | Sitemap Generator | `sitemap` | `$.sitemap` | `src/pages/seotools/SitemapGenerator.jsx` |
| 13 | Speed Test | `speed_test` | — | Various |
| 14 | LLMs.txt Generator | `llmsTxt` | — | `src/semanticsx/components/LlmsTxtGenerator.jsx` |

**Note**: LLMs.txt is stored at `$.llmsTxt` (NOT nested under `$.toolResults`)

---

## Top-Level Data (Not in toolResults)

| Data Key | Module | Storage Path | Type | Source |
|----------|--------|--------------|------|--------|
| `branded-keywords` | Keyword Research | `$.branded-keywords` | Array | `KeywordCannibalization.jsx` |
| `contentWriter_articles` | Content Writer | `$.contentWriter_articles` | Array | `ContentWriterDashboard.jsx` |
| `contentWriter_state` | Content Writer | `$.contentWriter_state` | Object | `SemanticContentWriter.jsx` |
| `onpage-*` | On-Page Analyzer | `$.onpage-*` | Object | `OnPageAnalyzer.jsx` |
| Various metadata | Project Config | Root level | Mixed | `CrawlContext.jsx` |

---

## Project Metadata Fields (Root Level)

```javascript
{
  owner: string,              // Project owner name
  scope: string,              // Crawl scope
  folder: string,             // Folder setting
  ownerUid: string,           // User ID
  protocol: string,          // Protocol setting
  renderJs: boolean,         // JS rendering enabled
  schedule: string,          // Crawl schedule
  urlLimit: number,          // Max URLs to crawl
  createdAt: string,         // ISO timestamp
  userAgent: string,         // User agent for crawling
  ownerEmail: string,        // Owner email
  notifyEmail: boolean,      // Email notifications
  respectRobots: boolean     // Respect robots.txt
}
```

---

## Common Tool Result Wrapper

Every tool result includes:

```javascript
{
  result: { /* tool-specific data */ },
  ownerUid: "user_id",
  ownerEmail: "user@example.com",
  projectUrl: "https://example.com",
  updatedAt: "2026-07-31 10:17:42.433"
}
```

---

## Data Storage Summary

- **Total Modules**: 20+ (14 tool results + top-level data)
- **Primary Storage**: `user_projects.project_data` (JSON column)
- **Backup Storage**: `tool_results` table (for each tool result)
- **Access Method**: `/api/projects` endpoint with `action` parameter

---

## Key Storage Locations

### Nested in toolResults
```
project_data.toolResults.{
  dashboardChecks,
  eeat,
  semantic,
  robots,
  speed,
  duplicate,
  gsc,
  bing,
  backlinks,
  plagiarism,
  crawlOptimization,
  sitemap,
  speed_test
}
```

### At Root Level (NOT nested)
```
project_data.{
  llmsTxt,
  branded-keywords,
  contentWriter_articles,
  contentWriter_state,
  onpage-*,
  ... project metadata fields ...
}
```

---

## Sample Query Pattern (MySQL JSON)

To retrieve a specific tool's result:

```sql
-- Get EEAT audit result
SELECT JSON_EXTRACT(project_data, '$.toolResults.eeat.result') as eeat_result
FROM user_projects
WHERE project_id = 'proj_xxx' AND user_id = 'user_id';

-- Get LLMs.txt content (note: NOT nested in toolResults)
SELECT JSON_EXTRACT(project_data, '$.llmsTxt.llmsTxt') as llms_content
FROM user_projects
WHERE project_id = 'proj_xxx' AND user_id = 'user_id';

-- Get all branded keywords
SELECT JSON_EXTRACT(project_data, '$."branded-keywords"') as branded_keywords
FROM user_projects
WHERE project_id = 'proj_xxx' AND user_id = 'user_id';
```

---

## Files to Update When Adding New Module

1. **Backend**:
   - `functions/api/projects.js` - Add to `TOOL_RESULT_KEYS` and `getToolResultPaths()`
   - Add API handler for `/api/projects?action=saveToolResult&toolKey=newKey`

2. **Frontend**:
   - Create tool component
   - Use `saveToolResult()` from `src/lib/projectsApi.js`
   - Use `loadToolResult()` to retrieve saved results
   - Optional: Create hook like `useTechSeoToolResult.js`

3. **Documentation**:
   - Update this file with new module details
   - Update database documentation

