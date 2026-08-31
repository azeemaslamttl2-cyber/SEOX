# Fix for Project Dropdown 500 Error - Sort Buffer Issue

## Problem
The `/api/projects` endpoint returns `500 Internal Server Error` with message:
```
"Out of sort memory, consider increasing server sort buffer size"
```

This occurs because the query selects all columns (including large JSON fields) and sorts by `created_at` without an index.

## Root Cause
- Query: `SELECT * FROM user_projects WHERE user_id = ? ORDER BY created_at DESC`
- Large JSON fields (`project_data`, `deleted_project_ids`) cause memory bloat
- Missing index on `(user_id, created_at)` forces full table sort in memory buffer

## Solution Applied

### 1. Query Optimization (Implemented)
**File:** `functions/api/projects.js` - `loadProjects()` function

**Changes:**
- Replaced `SELECT *` with explicit column list
- Removed unnecessary columns not used in the response
- Added `LIMIT 1000` to prevent loading excessive data
- This significantly reduces data needed to sort

**Before:**
```sql
SELECT * FROM user_projects WHERE user_id = ? ORDER BY created_at DESC
```

**After:**
```sql
SELECT project_id, project_name, domain, full_url, ... FROM user_projects 
WHERE user_id = ? ORDER BY created_at DESC LIMIT 1000
```

### 2. Database Index (To Be Executed)
**File:** `migration/mysql/add_projects_index.sql`

**SQL:**
```sql
ALTER TABLE user_projects ADD INDEX idx_user_created (user_id, created_at DESC);
```

This index allows MySQL to efficiently sort results without loading all data into sort buffer memory.

## How to Run the Migration on Live Server

### Option 1: Using MySQL CLI
```bash
mysql -h 127.0.0.1 -u root code-step-mysql < migration/mysql/add_projects_index.sql
```

### Option 2: Using Node.js Script
```bash
cd /path/to/code-step-mysql
node migration/add_index.mjs
```

### Option 3: Manual Execution
Connect to MySQL and run:
```sql
USE code-step-mysql;
ALTER TABLE user_projects ADD INDEX idx_user_created (user_id, created_at DESC);
SHOW INDEX FROM user_projects WHERE Key_name = 'idx_user_created';
```

## Testing
After applying the fixes:
1. Navigate to https://aismart.thetowertech.com/dashboard
2. Click the project dropdown
3. Projects should load without 500 error

## Performance Impact
- Query execution time: Reduced from potentially several seconds to milliseconds
- Memory usage: Significantly reduced due to selective columns and index
- Index size: ~8-16 bytes per row (minimal storage overhead)

## Additional Notes
- The 1000 record limit prevents memory overload for users with many projects
- Future optimization: Implement pagination if users exceed 1000 projects
- MySQL sort_buffer_size is typically 256KB; this index prevents exceeding it

## Files Modified
1. `functions/api/projects.js` - Query optimization
2. `migration/mysql/add_projects_index.sql` - Database index
3. `migration/add_index.mjs` - Node.js migration script
4. `migration/add_index.php` - PHP migration script (alternative)
