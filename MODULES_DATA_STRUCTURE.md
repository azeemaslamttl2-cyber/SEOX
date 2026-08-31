# Complete List of Modules Saving Data to user_projects (project_data column)

## Data Storage Location
All data is stored in the `user_projects` table, in the `project_data` JSON column, organized as follows:

### Main Storage Structure
```
project_data: {
  // Tool Results (nested under $.toolResults.{toolKey})
  toolResults: { ... },
  
  // Top-level project metadata and other data
  // Various other keys
}
```

---

## 1. Tool Results (Stored in `$.toolResults.{toolKey}`)

### Defined Tool Keys (TOOL_RESULT_KEYS):
These tools are officially registered and their results are stored as `project_data.toolResults.{toolKey}`:

#### 1.1 Dashboard Checks
- **Key**: `dashboardChecks`
- **Source**: `src/pages/Dashboard.jsx`, `src/hooks/useProjectToolChecks.js`
- **Data Structure**:
```json
{
  "result": {
    "tools": {
      "gsc": { "key": "gsc", "score": null, "status": "skipped", ... },
      "bing": { "key": "bing", "status": "skipped", ... },
      "robots": { "key": "robots", "score": 50, "status": "complete", ... },
      "duplicate": { "key": "duplicate", "score": 100, "status": "complete", ... }
    },
    "status": "complete",
    "version": 1,
    "projectId": "proj_xxx",
    "metrics": { "clicks": 0, "impressions": 0, "ctr": 0, "position": 0 }
  },
  "ownerUid": "user_id",
  "ownerEmail": "email@example.com",
  "projectUrl": "https://example.com",
  "updatedAt": "2026-07-31 10:17:42.433"
}
```

#### 1.2 E-E-A-T Audit
- **Key**: `eeat`
- **Source**: `src/pages/techseo/EeatAudit.jsx`
- **Data Structure**:
```json
{
  "result": {
    "url": "https://example.com/",
    "score": 21,
    "rating": "Poor",
    "sections": [
      {
        "id": "authority",
        "title": "Authority & Technical",
        "total": 10,
        "checks": [],
        "passed": 3,
        "percent": 30
      }
    ],
    "cachedAgo": "Just now",
    "manualTotal": 47,
    "failedChecks": 57,
    "passedChecks": 15,
    "totalAutomated": 72,
    "manualCompleted": 0
  },
  "ownerUid": "user_id",
  "ownerEmail": "email@example.com",
  "projectUrl": "https://example.com",
  "updatedAt": "2026-07-31 10:30:53.410"
}
```

#### 1.3 Semantic Audit
- **Key**: `semantic`
- **Source**: `src/pages/techseo/SemanticAudit.jsx`
- **Data Structure**:
```json
{
  "result": {
    "url": "https://example.com/",
    "entities": [],
    "seoScore": 35,
    "cachedAgo": "Just now",
    "imageAlts": [],
    "plainText": "No visible text could be extracted...",
    "hyperlinks": [],
    "performance": [],
    "seoAnalysis": []
  },
  "ownerUid": "user_id",
  "ownerEmail": "email@example.com",
  "projectUrl": "https://example.com",
  "updatedAt": "2026-07-31 10:31:36.538"
}
```

#### 1.4 Robots.txt Analyzer
- **Key**: `robots`
- **Source**: `src/pages/techseo/RobotsAnalyzer.jsx`
- **Data Structure**:
```json
{
  "result": {
    "url": "https://example.com/",
    "status": "success",
    "rules": [],
    "sitemaps": [],
    "score": 50,
    "analysis": []
  },
  "ownerUid": "user_id",
  "ownerEmail": "email@example.com",
  "projectUrl": "https://example.com",
  "updatedAt": "2026-07-31 10:24:05.075"
}
```

#### 1.5 Speed Optimization / PageSpeed Insights
- **Key**: `speed` (stored as `$.toolResults.speed` or legacy `$.speed_test`)
- **Source**: `src/pages/techseo/SpeedOptimization.jsx`
- **Data Structure**:
```json
{
  "result": {
    "cwv": [
      {
        "full": "Largest Contentful Paint",
        "good": true,
        "value": "--",
        "metric": "LCP"
      },
      {
        "full": "First Contentful Paint",
        "good": true,
        "value": "--",
        "metric": "FCP"
      },
      {
        "full": "Cumulative Layout Shift",
        "good": true,
        "value": "--",
        "metric": "CLS"
      }
    ],
    "url": "https://example.com/",
    "mobile": { "label": "Mobile Score", "score": 81 },
    "desktop": { "label": "Desktop Score", "score": 81 },
    "sections": []
  },
  "ownerUid": "user_id",
  "ownerEmail": "email@example.com",
  "projectUrl": "https://example.com",
  "updatedAt": "2026-07-31 10:24:05.075"
}
```

#### 1.6 Duplicate Checker
- **Key**: `duplicate` (stored as `$.toolResults.duplicate` or legacy `$.duplicate`)
- **Source**: `src/pages/techseo/DuplicateChecker.jsx`
- **Data Structure**:
```json
{
  "result": {
    "url": "https://example.com/",
    "duplicates": [],
    "score": 100,
    "analysis": []
  },
  "ownerUid": "user_id",
  "ownerEmail": "email@example.com",
  "projectUrl": "https://example.com",
  "updatedAt": "2026-07-31 10:30:53.410"
}
```

#### 1.7 Google Search Console (GSC) Audit
- **Key**: `gsc`
- **Source**: `src/pages/techseo/GscAudit.jsx`
- **Data Structure**:
```json
{
  "result": {
    "url": "https://example.com/",
    "status": "success",
    "metrics": {
      "clicks": 100,
      "impressions": 5000,
      "ctr": 2.0,
      "position": 10.5
    },
    "queries": [],
    "pages": [],
    "analysis": []
  },
  "ownerUid": "user_id",
  "ownerEmail": "email@example.com",
  "projectUrl": "https://example.com",
  "updatedAt": "2026-07-31 10:31:36.538"
}
```

#### 1.8 Bing Webmaster Tools
- **Key**: `bing`
- **Source**: `src/pages/techseo/BingWebmaster.jsx`
- **Data Structure**:
```json
{
  "result": {
    "url": "https://example.com/",
    "status": "success",
    "metrics": {
      "clicks": 50,
      "impressions": 2000,
      "ctr": 2.5,
      "position": 12.0
    },
    "queries": [],
    "pages": [],
    "analysis": []
  },
  "ownerUid": "user_id",
  "ownerEmail": "email@example.com",
  "projectUrl": "https://example.com",
  "updatedAt": "2026-07-31 10:31:36.538"
}
```

#### 1.9 Backlinks Audit
- **Key**: `backlinks` (stored as `$.toolResults.backlinks` or legacy `$.backlinks_audit`)
- **Source**: `src/pages/techseo/BacklinksAudit.jsx`
- **Data Structure**:
```json
{
  "result": {
    "url": "https://example.com/",
    "totalBacklinks": 150,
    "referringDomains": 45,
    "backlinks": [
      {
        "source": "https://source-site.com",
        "target": "https://example.com",
        "anchorText": "keyword",
        "type": "dofollow"
      }
    ],
    "analysis": []
  },
  "ownerUid": "user_id",
  "ownerEmail": "email@example.com",
  "projectUrl": "https://example.com",
  "updatedAt": "2026-07-31 10:31:36.538"
}
```

#### 1.10 Plagiarism Checker
- **Key**: `plagiarism`
- **Source**: `src/pages/techseo/PlagiarismChecker.jsx`
- **Data Structure**:
```json
{
  "result": {
    "url": "https://example.com/",
    "plagiarismScore": 5.2,
    "status": "success",
    "analysis": [],
    "sources": []
  },
  "ownerUid": "user_id",
  "ownerEmail": "email@example.com",
  "projectUrl": "https://example.com",
  "updatedAt": "2026-07-31 10:31:36.538"
}
```

#### 1.11 Crawl Optimization
- **Key**: `crawlOptimization` (stored as `$.toolResults.crawlOptimization` or legacy `$.crawl_optimization`)
- **Source**: `src/pages/techseo/CrawlOptimization.jsx`
- **Data Structure**:
```json
{
  "result": {
    "low": 0,
    "url": "https://example.com/",
    "clean": 15,
    "medium": 3,
    "sections": [],
    "totalChecks": 21,
    "highPriority": 3,
    "pageSourceSize": "5.6 KB"
  },
  "ownerUid": "user_id",
  "ownerEmail": "email@example.com",
  "projectUrl": "https://example.com",
  "updatedAt": "2026-07-31 11:06:32.375"
}
```

#### 1.12 Sitemap Generator
- **Key**: `sitemap` (stored as `$.toolResults.sitemap` or legacy `$.sitemap`)
- **Source**: `src/pages/seotools/SitemapGenerator.jsx`
- **Data Structure**:
```json
{
  "result": {
    "url": "https://example.com/",
    "sitemaps": [
      "https://example.com/sitemap.xml"
    ],
    "urlCount": 150,
    "status": "success",
    "analysis": []
  },
  "ownerUid": "user_id",
  "ownerEmail": "email@example.com",
  "projectUrl": "https://example.com",
  "updatedAt": "2026-07-31 11:06:32.375"
}
```

#### 1.13 Speed Test
- **Key**: `speed_test`
- **Source**: Various speed testing tools
- **Data Structure**: Same as `speed` (alternate storage location for backward compatibility)

#### 1.14 LLMs.txt Generator
- **Key**: `llmsTxt` (stored directly at `$.llmsTxt`, NOT under `$.toolResults`)
- **Source**: `src/semanticsx/components/LlmsTxtGenerator.jsx`
- **Data Structure**:
```json
{
  "llmsTxt": "# LLMs.txt content here...",
  "extractedUrls": ["https://example.com/page1", "https://example.com/page2"],
  "ownerUid": "user_id",
  "ownerEmail": "email@example.com",
  "projectUrl": "https://example.com",
  "updatedAt": "2026-07-31 11:06:32.375"
}
```

---

## 2. Top-Level Project Data (Not in toolResults)

### 2.1 Branded Keywords
- **Key**: `branded-keywords`
- **Source**: `src/pages/keywords/KeywordCannibalization.jsx`
- **Data Structure**:
```json
{
  "branded-keywords": [
    {
      "keyword": "brand name",
      "clicks": 100,
      "impressions": 5000,
      "ctr": 2.0,
      "position": 1.5,
      "lastSeen": "2026-07-31T10:00:00Z"
    }
  ]
}
```

### 2.2 Content Writer Articles
- **Key**: `contentWriter_articles`
- **Source**: `src/pages/content/ContentWriterDashboard.jsx`, `src/pages/content/SemanticContentWriter.jsx`
- **Data Structure**:
```json
{
  "contentWriter_articles": [
    {
      "id": "article_123",
      "title": "Article Title",
      "content": "Article content...",
      "status": "draft|published|archived",
      "topic": "Keyword or topic",
      "createdAt": "2026-07-31T10:00:00Z",
      "updatedAt": "2026-07-31T10:30:00Z",
      "wordCount": 1500,
      "seoScore": 75
    }
  ]
}
```

### 2.3 Content Writer State
- **Key**: `contentWriter_state`
- **Source**: `src/pages/content/SemanticContentWriter.jsx`
- **Data Structure**:
```json
{
  "contentWriter_state": {
    "currentArticleId": "article_123",
    "lastSavedAt": "2026-07-31T10:30:00Z",
    "editorState": "text content here",
    "focusedTopic": "target keyword",
    "seoGuidelines": { /* SEO analysis data */ }
  }
}
```

### 2.4 On-Page Analyzer Data
- **Key**: `onpage-analysis` or custom project-specific keys
- **Source**: `src/pages/onpage/OnPageAnalyzer.jsx`
- **Data Structure**:
```json
{
  "onpage-analysis": {
    "url": "https://example.com/page",
    "title": "Page Title",
    "metaDescription": "Meta description...",
    "headings": [],
    "keywordDensity": {},
    "readability": 75,
    "seoScore": 80,
    "issues": [],
    "lastAnalyzed": "2026-07-31T10:30:00Z"
  }
}
```

### 2.5 Project Metadata (Top-level properties)
- **Key**: Various metadata fields at root level
- **Source**: `src/context/CrawlContext.jsx`, `src/lib/projectsApi.js`
- **Data Structure**:
```json
{
  "owner": "Admin User",
  "scope": "subdomains",
  "folder": "none",
  "ownerUid": "1",
  "protocol": "https-http",
  "renderJs": false,
  "schedule": "weekly",
  "urlLimit": 10000,
  "createdAt": "2026-07-31T10:17:39.344Z",
  "userAgent": "seox-desktop",
  "ownerEmail": "admin@example.com",
  "notifyEmail": true,
  "respectRobots": true
}
```

---

## 3. Database Schema

```sql
CREATE TABLE user_projects (
  user_id VARCHAR(255) NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  
  -- JSON column containing all tool results and project data
  project_data JSON NOT NULL,
  
  -- Metadata
  selected_project_id VARCHAR(255),
  deleted_project_ids JSON,
  
  PRIMARY KEY (user_id, project_id),
  INDEX idx_project_id (project_id),
  INDEX idx_created_at (created_at)
);
```

---

## 4. Legacy/Alternative Storage Paths

The `getToolResultPaths()` function supports legacy paths for backward compatibility:

| Current Key | Legacy Paths |
|------------|--------------|
| `speed` | `$.speed_test` |
| `crawlOptimization` | `$.crawl_optimization` |
| `semantic` | `$.semantic_audit` |
| `eeat` | `$.eeat` |
| `robots` | `$.robots` |
| `backlinks` | `$.backlinks_audit` |
| `duplicate` | `$.duplicate` |
| `sitemap` | `$.sitemap` |

---

## 5. API Endpoints for Data Management

### Save Tool Result
```
POST /api/projects
  action: "saveToolResult"
  projectId: "proj_xxx"
  toolKey: "eeat" | "robots" | "semantic" | etc.
  result: { ...tool result data }
```

### Load Tool Result
```
GET /api/projects
  action: "toolResult"
  projectId: "proj_xxx"
  toolKey: "eeat" | "robots" | "semantic" | etc.
```

### Save Project Data (for top-level keys)
```
POST /api/projects
  action: "saveProjectData"
  projectId: "proj_xxx"
  key: "branded-keywords" | "contentWriter_articles" | etc.
  value: { ...data }
```

---

## Summary Table

| Module/Tool | Key | Storage Path | Data Type | Source File |
|------------|-----|--------------|-----------|------------|
| Dashboard Checks | `dashboardChecks` | `$.toolResults.dashboardChecks` | Object | `Dashboard.jsx` |
| E-E-A-T Audit | `eeat` | `$.toolResults.eeat` (legacy: `$.eeat`) | Object | `EeatAudit.jsx` |
| Semantic Audit | `semantic` | `$.toolResults.semantic` (legacy: `$.semantic_audit`) | Object | `SemanticAudit.jsx` |
| Robots.txt Analyzer | `robots` | `$.toolResults.robots` (legacy: `$.robots`) | Object | `RobotsAnalyzer.jsx` |
| Speed Optimization | `speed` | `$.toolResults.speed` (legacy: `$.speed_test`) | Object | `SpeedOptimization.jsx` |
| Duplicate Checker | `duplicate` | `$.toolResults.duplicate` (legacy: `$.duplicate`) | Object | `DuplicateChecker.jsx` |
| GSC Audit | `gsc` | `$.toolResults.gsc` | Object | `GscAudit.jsx` |
| Bing Webmaster | `bing` | `$.toolResults.bing` | Object | `BingWebmaster.jsx` |
| Backlinks Audit | `backlinks` | `$.toolResults.backlinks` (legacy: `$.backlinks_audit`) | Object | `BacklinksAudit.jsx` |
| Plagiarism Checker | `plagiarism` | `$.toolResults.plagiarism` | Object | `PlagiarismChecker.jsx` |
| Crawl Optimization | `crawlOptimization` | `$.toolResults.crawlOptimization` (legacy: `$.crawl_optimization`) | Object | `CrawlOptimization.jsx` |
| Sitemap Generator | `sitemap` | `$.toolResults.sitemap` (legacy: `$.sitemap`) | Object | `SitemapGenerator.jsx` |
| Speed Test | `speed_test` | `$.toolResults.speed_test` | Object | Various |
| LLMs.txt Generator | `llmsTxt` | `$.llmsTxt` (NOT nested) | Object | `LlmsTxtGenerator.jsx` |
| Branded Keywords | `branded-keywords` | `$.branded-keywords` | Array | `KeywordCannibalization.jsx` |
| Content Writer Articles | `contentWriter_articles` | `$.contentWriter_articles` | Array | `ContentWriterDashboard.jsx` |
| Content Writer State | `contentWriter_state` | `$.contentWriter_state` | Object | `SemanticContentWriter.jsx` |
| On-Page Analyzer | Various | `$.onpage-*` | Object | `OnPageAnalyzer.jsx` |
| Project Metadata | Various | Root level | Mixed | `CrawlContext.jsx` |

