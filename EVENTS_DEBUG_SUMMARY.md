# Events Not Showing Up - Debug Summary

## What I Found

✅ **Backend is working correctly:**
- The API endpoint `/events?chapter_id=...` is returning **4 active events** correctly
- Events found:
  1. Rush Kickoff (2026-01-15)
  2. Main BBQ (2026-01-16)
  3. Surf w/ Celsius (2026-01-17)
  4. Beta Bahama (2026-01-18)

✅ **Database has correct data:**
- All 4 events have `is_active = true`
- All events belong to your chapter: "Beta Theta Pi - Cal Poly"
- Chapter ID: `3a742541-72d0-45e7-a657-ca0db50b8aaf`

## Possible Issues

The frontend might not be displaying events due to:

1. **API call failing** - Check browser console for errors
2. **Authentication issue** - Token might be expired
3. **Caching issue** - React Query might be caching empty results
4. **Chapter ID mismatch** - Frontend might be using wrong chapter ID

## Quick Fixes to Try

1. **Hard refresh the page** (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
2. **Check browser console** for any errors when loading the events page
3. **Check Network tab** - Look for the `/events?chapter_id=...` request and see if it's:
   - Being made at all
   - Returning 200 status
   - Returning the 4 events in the response
4. **Clear browser cache/localStorage** - The events might be cached as empty
5. **Log out and log back in** - This will refresh your auth token

## If Events Still Don't Show

Run this in the browser console on the events page to debug:

```javascript
// Check what chapter ID is being used
const chapters = await fetch('/api/chapters', {
  headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
}).then(r => r.json());
console.log('Chapters:', chapters);

// Check what events are returned
const events = await fetch(`/api/events?chapter_id=${chapters[0].id}`, {
  headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
}).then(r => r.json());
console.log('Events:', events);
```

## Migration Created

I've created a migration file (`supabase/migrations/0007_update_events_schema.sql`) that ensures the events table has the correct schema. If you haven't run migrations recently, you may want to apply this migration to ensure all events have the `is_active` field properly set.
