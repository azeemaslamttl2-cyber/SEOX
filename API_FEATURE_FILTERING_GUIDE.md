# API Feature Filtering - Implementation Guide

## Issue Fixed

**Problem:** The initial implementation expected features to be in a `toolResults` container, but the actual data structure stores features as top-level properties in `project_data`.

**Solution:** Updated `extractFeatureData()` to correctly identify and filter features from the actual project data structure.

## Data Structure

### Actual Project Data Structure
```json
{
  "project_data": {
    "eeat": "{...JSON string...}",
    "speed_test": "{...JSON string...}",
    "semantic": "{...JSON string...}",
    "owner": "Admin User",
    "scope": "subdomains",
    "ownerEmail": "azeemalsamhh@gmail.com",
    "createdAt": "2026-07-31T11:18:19.892Z",
    "...other metadata..."
  }
}
```

### Key Points
- Features are **top-level properties** in `project_data` (NOT in `toolResults`)
- Feature values are **JSON strings** that are automatically parsed
- Metadata fields (owner, scope, ownerEmail, etc.) are excluded from feature list
- Feature names: `eeat`, `speed_test`, `semantic`, `robots`, `duplicate`, etc.

## API Usage

### Base Endpoint
```
https://aismart.thetowertech.com/api/project-details
```

### Query Parameters
- `admin_token` (required) - Admin authentication token
- `project_id` OR `url` (required) - Project identifier
- `feature` (optional) - Specific feature to retrieve

### Examples

#### 1. Get E-E-A-T Feature
```bash
curl "http://localhost:3000/api/project-details?admin_token=fdghsungicrgb7s7igsi7bds7dgb&project_id=proj_1785496699892&feature=eeat"
```

**Response:**
```json
{
  "project_id": "proj_1785496699892",
  "project_data": {
    "eeat": {
      "url": "https://ucp.edu.pk/",
      "score": 74,
      "rating": "Needs Work",
      "passedChecks": 53,
      "failedChecks": 19,
      "sections": [...]
    }
  },
  "full_url": "https://ucp.edu.pk",
  "project_name": "https://ucp.edu.pk/"
}
```

#### 2. Get Speed Test Results
```bash
curl "http://localhost:3000/api/project-details?admin_token=xxx&project_id=proj_1785496699892&feature=speed_test"
```

#### 3. Get Speed (Auto-Normalized to speed_test)
```bash
curl "http://localhost:3000/api/project-details?admin_token=xxx&project_id=proj_1785496699892&feature=speed"
```

#### 4. Get All Data (No Feature Parameter)
```bash
curl "http://localhost:3000/api/project-details?admin_token=xxx&project_id=proj_1785496699892"
```

## Available Features

The following features are typically available (varies by project):
- `eeat` - E-E-A-T Analysis
- `speed_test` - Speed/PageSpeed Results (also accepts `speed`)
- `semantic` - Semantic Analysis
- `robots` - Robots.txt Analysis
- `duplicate` - Duplicate Content Checker
- And any other analysis features stored in the project

## Error Handling

### 404 - Feature Not Found
```json
{
  "error": "Feature 'eeat' not found or not available for this project. Available features include: speed_test, semantic"
}
```

This error means:
1. The project doesn't have the requested feature
2. The feature hasn't been run/analyzed yet
3. Check the "Available features include:" list for valid features

### 400 - Missing Required Parameters
```json
{
  "error": "admin_token is required"
}
```

### 401 - Invalid Token
```json
{
  "error": "Invalid admin token"
}
```

### 404 - Project Not Found
```json
{
  "error": "Project not found"
}
```

## Implementation Details

### Feature Filtering Logic
1. Validate admin token and project
2. Retrieve project_data from database
3. If `feature` parameter is provided:
   - Normalize feature name to lowercase
   - Check if it's a metadata field (skip it)
   - Return only that feature
   - Parse JSON strings automatically
   - Support feature name normalization (speed → speed_test)
4. If `feature` is not provided, return all project_data (backward compatible)

### Metadata Fields (Excluded from Features)
```javascript
owner, scope, folder, ownerUid, protocol, renderJs, schedule, 
urlLimit, createdAt, userAgent, ownerEmail, notifyEmail, respectRobots
```

### Feature Name Normalization
- `speed` is automatically mapped to `speed_test`
- Feature names are case-insensitive (EEAT, eeat, Eeat all work)

## Testing

Run all tests:
```bash
node --test functions/_handlers/project-details.test.js
```

**Result: 15/15 tests passing** ✅

Test coverage includes:
- Backward compatibility
- Feature filtering
- JSON string parsing
- Case-insensitive names
- Error handling
- Feature name normalization

## Changed Files

1. **functions/api/project-details.js**
   - Added `feature` parameter extraction from query string

2. **functions/_handlers/project-details.js**
   - Updated `validateProjectDetailsInput()` to accept feature parameter
   - Rewrote `extractFeatureData()` to handle actual data structure
   - Features are now filtered from top-level project_data properties

3. **functions/_handlers/project-details.test.js**
   - Updated tests to reflect actual data structure
   - All feature filtering tests now use actual JSON string format
   - Added test for JSON string parsing

## Backward Compatibility

✅ **100% Backward Compatible**
- Existing API calls without `feature` parameter work unchanged
- All existing integrations continue to work
- New feature parameter is optional

## Feature Requests

If you want to request a feature for a project but it hasn't been analyzed yet:
1. The API will return 404 with available features
2. Check if the feature needs to be run in your analysis settings
3. Ensure the feature is enabled in the project configuration

---

**Last Updated:** 2026-08-17  
**Status:** Production Ready ✅  
**Tests Passing:** 15/15
