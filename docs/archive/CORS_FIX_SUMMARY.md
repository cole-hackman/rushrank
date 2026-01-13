# CORS and Port Configuration Fixes

## Issues Fixed

### 1. Backend Port Configuration
- **Problem**: Backend was defaulting to port 5000 instead of 8000
- **Fixed**: Updated `python_server/main.py` and `run_fastapi.py` to default to port 8000
- **Files Changed**:
  - `python_server/main.py` - Changed default port from 5000 to 8000
  - `run_fastapi.py` - Changed default port from 5000 to 8000

### 2. CORS Configuration
- **Problem**: CORS was blocking requests with 403 errors
- **Fixed**: Enhanced CORS middleware to explicitly allow localhost origins
- **Files Changed**:
  - `python_server/main.py` - Added explicit localhost origins to CORS allow list

### 3. ToastProvider Duplicate Keys
- **Problem**: React warnings about duplicate keys in ToastProvider
- **Fixed**: Added counter to ensure unique IDs for toasts
- **Files Changed**:
  - `frontend/components/ToastProvider.tsx` - Added idCounter to prevent duplicate keys

### 4. API Debugging
- **Added**: Console logging in development mode to track API calls
- **Files Changed**:
  - `frontend/lib/api.ts` - Added debug logging for API calls

## Next Steps - IMPORTANT

### 1. Restart Backend Server
The backend needs to be restarted to pick up the port change:

```bash
# Stop the current backend (Ctrl+C if running)
# Then restart it:
cd /Users/coleh/rushrank-0.0
source venv/bin/activate
python start_fastapi.py
# OR
python run_fastapi.py
```

**Verify it's running on port 8000:**
```bash
curl http://localhost:8000/health
```

### 2. Restart Frontend Dev Server
The frontend needs to be restarted to clear any cached API URLs:

```bash
# Stop the current frontend (Ctrl+C if running)
# Then restart it:
cd /Users/coleh/rushrank-0.0/frontend
npm run dev
```

### 3. Clear Browser Cache
If you still see port 5000 in the console:
1. Open browser DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"
4. Or use Ctrl+Shift+R (Cmd+Shift+R on Mac)

### 4. Verify Configuration
Check that the API base URL is correct:
1. Open browser DevTools Console
2. Look for `[API] GET http://localhost:8000/api/...` messages
3. If you see port 5000, the frontend needs to be restarted

## Expected Behavior After Fix

✅ All API calls should go to `http://localhost:8000/api/...`
✅ No more CORS 403 errors
✅ No more React duplicate key warnings
✅ Pages should load successfully

## Troubleshooting

If you still see port 5000 errors:
1. Check if backend is actually running on 8000: `lsof -i :8000`
2. Check if something is still running on 5000: `lsof -i :5000`
3. Verify environment variable: `echo $PORT` (should be empty or 8000)
4. Check frontend `.env.local` file for `NEXT_PUBLIC_API_BASE_URL`

If CORS errors persist:
1. Verify backend is running: `curl http://localhost:8000/health`
2. Check backend logs for CORS middleware initialization
3. Verify frontend is running on port 3000 (default Next.js port)

