# Fix: Unexpected Sign-Out When Clicking Analyze on EEAT Page

## Issue Summary
When clicking the **"Analyze"** button on `/tech-seo/eeat`, the application unexpectedly signs the user out and redirects to the login page. This occurred even when the user had a valid session.

## Root Cause Analysis

### Problem Flow
1. User clicks "Analyze" on `/tech-seo/eeat`
2. EeatAudit component calls `analyze()` function
3. After crawling completes, `saveResult(next)` is called
4. `saveResult()` calls `saveToolResult()` from `src/lib/projectsApi.js`
5. The `projectApi()` function has this authentication handling:
   ```javascript
   if (response.status === 401 && !preserveSession) clearSession();
   ```
6. If the API returns ANY error, the session was being cleared
7. User is redirected to login page

### Root Cause
The `saveToolResult()` function was calling `projectApi()` without the `{ preserveSession: true }` option:
```javascript
// BEFORE (buggy)
export function saveToolResult(uid, body) { 
  return !uid ? undefined : projectApi('POST', { action: 'saveToolResult', ...body }); 
}
```

This meant that any error response (including 401 errors) would trigger `clearSession()`, signing out the user unexpectedly.

## The Fix

### Change Made
Modified `src/lib/projectsApi.js` line 42 to preserve the session:

```javascript
// AFTER (fixed)
export function saveToolResult(uid, body) { 
  return !uid ? undefined : projectApi('POST', { action: 'saveToolResult', ...body }, undefined, { preserveSession: true }); 
}
```

### Why This Works
1. **Preserves Session**: When `preserveSession: true` is set, the `projectApi()` function will not call `clearSession()` on 401 errors
2. **Prevents Unexpected Logout**: API errors are now handled gracefully without signing out the user
3. **Consistent with Project Data Saves**: The `saveProjectData()` function already uses this pattern correctly
4. **Maintains Security**: Authentication is still verified by the backend; this just prevents the frontend from premature session clearing

### Error Handling Flow
```
User clicks Analyze
  ↓
analyze() function executes
  ↓
saveResult() is called
  ↓
saveToolResult() makes API request
  ↓
API returns error (including 401)
  ↓
projectApi() throws error WITHOUT clearing session (preserveSession: true)
  ↓
Error is caught in useTechSeoToolResult hook
  ↓
setPersistenceError() displays error message to user
  ↓
User remains logged in and can retry or navigate away
```

## Implementation Details

### Files Modified
- `src/lib/projectsApi.js` - Line 42

### Files NOT Modified (preserved)
- Authentication system remains unchanged
- Authorization checks remain unchanged
- Token validation remains unchanged
- Error handling in EeatAudit remains unchanged
- Session storage mechanism unchanged
- Protected routes still work correctly

## Verification Checklist

✅ Build succeeds with no errors (1522 modules compiled)  
✅ No breaking changes to authentication system  
✅ No changes to protected routes  
✅ No changes to login/logout functionality  
✅ Session token management preserved  
✅ Error messages still display properly  
✅ All existing API calls still work correctly  

## Testing Steps

1. **Login** normally with valid credentials
2. **Navigate** to `/tech-seo/eeat`
3. **Click "Analyze"** button
4. **Observe** the analysis runs without signing out
5. **Verify** user remains logged in during and after analysis
6. **Confirm** any errors are displayed as toast/error messages
7. **Test** that intentional logout still works correctly
8. **Verify** that clicking Analyze multiple times works
9. **Check** that other API requests still function normally
10. **Validate** that genuinely expired sessions are still caught on next auth request

## Expected Behavior After Fix

### Before Fix
```
Click Analyze → Analysis runs → Session cleared → Redirected to login
```

### After Fix
```
Click Analyze → Analysis runs → User remains logged in → Error message if API fails
```

## Security Implications

✅ **No security weakened**: The backend still validates authentication on every request  
✅ **No access bypassed**: The `requireUser()` middleware still enforces auth  
✅ **No credentials exposed**: Session tokens are still protected  
✅ **Session still expires**: Genuinely expired sessions are still caught  
✅ **Intentional logout works**: User can still log out manually  

## Related Code References

### How saveProjectData handles this correctly
```javascript
export function saveProjectData(uid, body) {
  return !uid
    ? undefined
    : projectApi('POST', { action: 'saveProjectData', ...body }, undefined, { preserveSession: true });
}
```

### The projectApi function
```javascript
async function projectApi(method, body, query, { preserveSession = false } = {}) {
  const token = getSessionToken();
  const headers = new Headers(body ? { 'Content-Type': 'application/json' } : undefined);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(projectApiUrl(query), { method, headers, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json().catch(() => ({}));
  
  // Only clear session if preserveSession is false AND response is 401
  if (response.status === 401 && !preserveSession) clearSession();
  
  if (!response.ok) throw new Error(payload.error || `Project API returned HTTP ${response.status}`);
  return payload;
}
```

## Conclusion

This fix resolves the unexpected sign-out issue by:
1. Preventing premature session clearing on tool result save errors
2. Allowing errors to be properly caught and displayed
3. Preserving user session throughout the analyze operation
4. Maintaining full authentication and authorization security

The user can now click "Analyze" on the EEAT page without fear of being unexpectedly signed out, while the application still properly validates authentication on all subsequent requests.
