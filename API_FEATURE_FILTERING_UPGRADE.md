# API Feature Filtering Upgrade

## Overview

The `/api/project-details` endpoint has been upgraded to support **optional feature filtering**. Callers can now request specific features/tools of a website instead of always receiving all available data.

## Changes Made

### 1. API Endpoint Enhancement (`functions/api/project-details.js`)
- Added support for the optional `feature` query parameter
- The parameter is passed to the handler for processing

### 2. Handler Logic Update (`functions/_handlers/project-details.js`)
- Updated `validateProjectDetailsInput()` to accept and validate the `feature` parameter
- Implemented `extractFeatureData()` helper function to filter project data based on requested feature
- Modified `createProjectDetailsHandler()` to apply feature filtering when requested

### 3. Comprehensive Tests (`functions/_handlers/project-details.test.js`)
Added 8 new test cases:
- ✅ Backward compatibility (no feature → returns all data)
- ✅ Top-level feature filtering (eeat, speed, semantic, etc.)
- ✅ Nested feature filtering (robots, duplicate, gsc, bing from dashboardChecks)
- ✅ Case-insensitive feature names (EEAT, eeat, Eeat all work)
- ✅ Error handling (404 for non-existent features)

**All 15 tests pass successfully.**

## API Usage

### Base URL
```
https://aismart.thetowertech.com/api/project-details
```

### Required Parameters
- `admin_token` - Administrator authentication token
- `project_id` OR `url` - Project identifier (project_id takes precedence)

### Optional Parameters
- `feature` - Specific feature to retrieve (case-insensitive)

## Examples

### 1. Get All Project Data (Original Behavior - Backward Compatible)
```
GET /api/project-details?admin_token=fdghsungicrgb7s7igsi7bds7dgb&project_id=proj_1786539618062
```

**Response:**
```json
{
  "project_id": "proj_1786539618062",
  "project_data": {
    "toolResults": {
      "eeat": { ... },
      "speed": { ... },
      "semantic": { ... },
      "dashboardChecks": { ... },
      "crawlOptimization": { ... }
    }
  },
  "full_url": "https://ucp.edu.pk/",
  "project_name": "UCP Website"
}
```

### 2. Get E-E-A-T Feature Only
```
GET /api/project-details?admin_token=fdghsungicrgb7s7igsi7bds7dgb&project_id=proj_1786539618062&feature=eeat
```

**Response:**
```json
{
  "project_id": "proj_1786539618062",
  "project_data": {
    "eeat": {
      "result": {
        "url": "https://ucp.edu.pk/",
        "score": 21,
        "rating": "Poor",
        "sections": [ ... ],
        "cachedAgo": "Just now",
        "failedChecks": 57,
        "passedChecks": 15
      },
      "ownerUid": "1",
      "updatedAt": "2026-07-31 10:30:53.410",
      "ownerEmail": "azeemalsamhh@gmail.com",
      "projectUrl": "https://ucp.edu.pk"
    }
  },
  "full_url": "https://ucp.edu.pk/",
  "project_name": "UCP Website"
}
```

### 3. Get Speed Test Results
```
GET /api/project-details?admin_token=fdghsungicrgb7s7igsi7bds7dgb&project_id=proj_1786539618062&feature=speed
```

**Response:**
```json
{
  "project_id": "proj_1786539618062",
  "project_data": {
    "speed": {
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
        "url": "https://ucp.edu.pk/",
        "mobile": { "label": "Mobile Score", "score": 81 },
        "desktop": { "label": "Desktop Score", "score": 81 }
      },
      "ownerUid": "1",
      "updatedAt": "2026-07-31 10:24:05.075",
      "ownerEmail": "azeemalsamhh@gmail.com",
      "projectUrl": "https://ucp.edu.pk"
    }
  },
  "full_url": "https://ucp.edu.pk/",
  "project_name": "UCP Website"
}
```

### 4. Get Robots.txt Analysis (Nested Feature)
```
GET /api/project-details?admin_token=fdghsungicrgb7s7igsi7bds7dgb&project_id=proj_1786539618062&feature=robots
```

**Response:**
```json
{
  "project_id": "proj_1786539618062",
  "project_data": {
    "dashboardChecks": {
      "result": {
        "tools": {
          "robots": {
            "key": "robots",
            "href": "/tech-seo/robots",
            "group": "Technical SEO",
            "label": "Robots.txt Analyzer",
            "score": 50,
            "status": "complete"
          }
        }
      }
    }
  },
  "full_url": "https://ucp.edu.pk/",
  "project_name": "UCP Website"
}
```

### 5. Get Duplicate Content Analysis (Nested Feature)
```
GET /api/project-details?admin_token=fdghsungicrgb7s7igsi7bds7dgb&project_id=proj_1786539618062&feature=duplicate
```

**Response:**
```json
{
  "project_id": "proj_1786539618062",
  "project_data": {
    "dashboardChecks": {
      "result": {
        "tools": {
          "duplicate": {
            "key": "duplicate",
            "href": "/tech-seo/duplicate",
            "group": "Content & Links",
            "label": "Duplicate Checker",
            "score": 100,
            "status": "complete"
          }
        }
      }
    }
  },
  "full_url": "https://ucp.edu.pk/",
  "project_name": "UCP Website"
}
```

### 6. Case-Insensitive Feature Names
All of these are equivalent and return the same result:
```
?feature=eeat
?feature=EEAT
?feature=Eeat
?feature=EEAt
```

## Available Features

### Top-Level Features
- `eeat` - E-E-A-T (Expertise, Authoritativeness, Trustworthiness) Analysis
- `speed` - Speed/PageSpeed Test Results
- `semantic` - Semantic Analysis
- `dashboardChecks` - Complete Dashboard Checks (includes all nested tools)
- `crawlOptimization` - Crawl Optimization Results

### Nested Features (Within dashboardChecks)
These can be requested individually:
- `robots` - Robots.txt Analyzer
- `duplicate` - Duplicate Content Checker
- `gsc` - Google Search Console Audit
- `bing` - Bing Webmaster
- (Any other tools added to dashboardChecks in the future)

## Error Handling

### Invalid Feature Name
```
GET /api/project-details?admin_token=fdghsungicrgb7s7igsi7bds7dgb&project_id=proj_1786539618062&feature=nonexistent
```

**Response (404):**
```json
{
  "error": "Feature 'nonexistent' not found or not available for this project. Available features include: eeat, speed, semantic, dashboardChecks, crawlOptimization"
}
```

### Missing Admin Token
```
GET /api/project-details?project_id=proj_1786539618062
```

**Response (400):**
```json
{
  "error": "admin_token is required"
}
```

### Project Not Found
```
GET /api/project-details?admin_token=fdghsungicrgb7s7igsi7bds7dgb&project_id=invalid_project_id
```

**Response (404):**
```json
{
  "error": "Project not found"
}
```

## Key Features

✅ **Backward Compatible** - Existing API consumers are unaffected; the `feature` parameter is optional

✅ **Generic Implementation** - New features can be added without modifying the API logic

✅ **Flexible** - Supports both top-level and nested features

✅ **Case-Insensitive** - Feature names work regardless of case

✅ **Well-Tested** - 15 comprehensive tests ensure reliability

✅ **Proper Error Handling** - Clear error messages when features don't exist

✅ **Maintains Data Structure** - Response structure remains consistent

## Implementation Details

### Feature Filtering Logic
1. If `feature` parameter is not provided, return complete project data (backward compatible)
2. If `feature` matches a top-level toolResults key, return only that feature's data
3. If `feature` matches a nested tool within dashboardChecks, return the full dashboardChecks structure with only that specific tool
4. If `feature` doesn't exist, return a 404 error with available features list

### Data Structure Preservation
- Top-level features maintain their original structure within toolResults
- Nested features preserve the dashboardChecks container but filter the tools object
- Response envelope (project_id, full_url, project_name) always included

## Testing

Run the test suite to verify the implementation:
```bash
node --test functions/_handlers/project-details.test.js
```

**Test Results: 15/15 PASSING** ✅

## Future Enhancements

1. Add support for feature search/discovery endpoint
2. Implement feature availability metadata
3. Add feature request caching for common queries
4. Support multiple features in single request: `?feature=eeat,speed,robots`

---

**Implementation Date:** 2026-08-17  
**Status:** Production Ready ✅
