# Debugging Events Not Showing Issue

## Problem
User `colehackman@icloud.com` logged in but cannot see events that should be visible.

## Debugging Tools Created

### 1. Database Debug Script
Run this to check user membership and events directly in the database:

```bash
python debug_user_events.py colehackman@icloud.com
```

This will show:
- If user exists in the database
- User's memberships (chapters they belong to)
- Events for each chapter (active and inactive counts)
- What the `/chapters` endpoint would return

### 2. API Testing Script
Test API endpoints directly:

```bash
# Get your access_token from browser localStorage after logging in
./test_api_endpoints.sh <your_access_token>
```

This tests:
- `/chapters` endpoint
- `/events?chapter_id=...` endpoint
- `/me` endpoint (user profile)

### 3. Browser Console Logging
Added detailed logging to help debug:

- `[ChapterID]` - Chapter ID caching operations
- `[EventsPage]` - Events page loading operations
- `[Dashboard]` - Dashboard page operations

Check browser console for these logs to see:
- What chapter ID is being used
- If events are being fetched
- Any errors during the process

## Common Issues & Solutions

### Issue 1: User Has No Membership
**Symptoms:**
- `/chapters` returns empty array
- Console shows "No chapter found"

**Solution:**
- User needs to be added to a chapter via invitation
- Or run `setup_user.py` to create membership
- Check database: `SELECT * FROM memberships WHERE user_id = '<user_id>'`

### Issue 2: Wrong Chapter ID Cached
**Symptoms:**
- Events page shows no events but user has membership
- Different chapter ID in cache vs actual membership

**Solution:**
- Clear browser localStorage: `localStorage.removeItem('rushapp_chapter_id')`
- Or use `getChapterId(true)` to force refresh
- Check console logs for chapter ID mismatches

### Issue 3: Events Are Inactive
**Symptoms:**
- Events exist in database but don't show
- Query returns 0 events

**Solution:**
- Check `is_active` flag: `SELECT * FROM events WHERE chapter_id = '<chapter_id>'`
- Events might be soft-deleted (`is_active = false`)
- Restore events: `UPDATE events SET is_active = true WHERE id = '<event_id>'`

### Issue 4: Membership Verification Failing
**Symptoms:**
- 403 "Access denied" errors
- Backend logs show membership verification failures

**Solution:**
- Verify membership exists: `SELECT * FROM memberships WHERE user_id = '<user_id>' AND chapter_id = '<chapter_id>'`
- Check user_id matches Supabase auth user ID
- Ensure membership role is valid ('admin', 'member', or 'observer')

## Backend Logging Added

The backend now logs:
- User authentication (user_id, email)
- Chapter queries (how many chapters found)
- Membership verification attempts
- Events queries (how many events found)

Check Render logs for these messages to trace the issue.

## Frontend Improvements

1. **Better Error Messages**: More specific error messages for different failure scenarios
2. **Console Logging**: Detailed logs to help debug in browser console
3. **Cache Debugging**: Functions to check and clear chapter ID cache
4. **Force Refresh**: `getChapterId(true)` to bypass cache

## Next Steps

1. **Run the debug script** to check user membership:
   ```bash
   python debug_user_events.py colehackman@icloud.com
   ```

2. **Check browser console** when loading events page - look for:
   - `[ChapterID]` logs
   - `[EventsPage]` logs
   - Any error messages

3. **Check Render backend logs** for:
   - Authentication errors
   - Membership verification failures
   - Events query results

4. **Test API directly** using the test script or browser Network tab

5. **Clear cache if needed**:
   - Open browser console
   - Run: `localStorage.removeItem('rushapp_chapter_id')`
   - Refresh page

## Quick Fixes to Try

1. **Clear all caches**:
   ```javascript
   localStorage.removeItem('rushapp_chapter_id');
   localStorage.removeItem('rushapp_events_cache');
   location.reload();
   ```

2. **Force refresh chapter ID**:
   - The code now supports `getChapterId(true)` to force refresh
   - Or manually clear cache and reload

3. **Check if user needs membership**:
   - Run debug script
   - If no membership, user needs to be invited to chapter
