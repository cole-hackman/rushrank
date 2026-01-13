# Voting Implementation Summary & Fix Plan

## Step 1: Current Implementation Analysis

### Database Tables

**Existing Tables:**
1. **`sessions`** table (✅ EXISTS):
   - `id` (uuid, PK)
   - `round_id` (uuid, FK to voting_rounds)
   - `join_code` (text, UNIQUE)
   - `current_pnm_id` (uuid, FK to pnms, nullable)
   - `locked` (boolean, default false)
   - `started_at` (timestamptz, nullable)
   - `ended_at` (timestamptz, nullable)

2. **`voting_rounds`** table:
   - `id` (uuid, PK)
   - `chapter_id` (uuid, FK)
   - `type` (text: 'GENERAL', 'SESSION', etc.)
   - `status` (text: 'ACTIVE', 'active', etc.)
   - `selected_pnm_ids` (text[] array)
   - `room_code` (text)
   - `started_at`, `ended_at`, `created_at`

3. **`votes`** table:
   - `id` (uuid, PK)
   - `round_id` (uuid, FK)
   - `pnm_id` (uuid, FK)
   - `voter_user_id` (uuid, FK to users)
   - `value` (vote_value enum: 'YES', 'NO', 'UNKNOWN')
   - `favorite` (boolean)
   - **UNIQUE constraint: (round_id, pnm_id, voter_user_id)** ✅ EXISTS

4. **`round_pnms`** table (for ordering):
   - `round_id` (uuid, FK)
   - `pnm_id` (uuid, FK)
   - `order_index` (integer)

### Backend Endpoints (FastAPI)

**Existing Endpoints:**
- ✅ `POST /api/sessions` - Creates session (line 1099-1187)
  - **ISSUE**: Doesn't set `current_pnm_id` to first PNM
  - **ISSUE**: Creates round with type 'SESSION' but doesn't initialize current_pnm_id

- ✅ `POST /api/sessions/join` - Joins session (line 1189-1241)
  - **ISSUE**: Doesn't return ordered PNM list
  - **ISSUE**: Doesn't return existing votes for user

- ✅ `GET /api/sessions/active` - Gets active session (line 1243-1289)
  - **ISSUE**: Doesn't return `is_chair` field (returns None instead of boolean)

- ✅ `POST /api/sessions/{id}/lock` - Locks/unlocks (line 1291-1319)
  - ✅ Works correctly

- ✅ `POST /api/sessions/{id}/advance` - Advances session (line 1321-1365)
  - **ISSUE**: Logic looks correct but needs to handle first PNM initialization

- ✅ `GET /api/sessions/{id}/current` - Gets current PNM (line 1367-1421)
  - ✅ Works correctly

- ✅ `POST /api/votes` - Creates/updates votes (line 506-569)
  - **ISSUE**: Doesn't return updated vote tallies (yes/no/unknown/favorites)

### Frontend Implementation

**Voting Page** (`frontend/app/(dashboard)/voting/page.tsx`):
- Has "Open Voting" and "Live Session" tabs
- **ISSUE**: Shows "Loading active round..." when no session exists
- **ISSUE**: `loadActiveSession()` calls `/sessions/active` but doesn't handle null properly
- **ISSUE**: No proper empty state when no active session
- Uses Supabase Realtime for updates (line 335-344) but might not be configured

### Realtime Implementation

**Current**: Uses Supabase Realtime channel subscription (line 335-344)
- Subscribes to `session:{session_id}` channel
- Listens for "broadcast" events with type "state"
- **ISSUE**: Backend doesn't broadcast updates via Supabase Realtime

---

## Step 2: Data Model Confirmation

✅ **Sessions table exists** with all required fields:
- `id`, `round_id`, `join_code`, `current_pnm_id`, `locked`, `started_at`, `ended_at`

✅ **Votes table has unique constraint** on `(round_id, pnm_id, voter_user_id)`

**No migration changes needed** - schema is correct!

---

## Step 3: Fixes Required

### Backend Fixes

1. **POST /api/sessions**:
   - Set `current_pnm_id` to first PNM in `selected_pnm_ids` array
   - Ensure session is properly initialized

2. **POST /api/sessions/join**:
   - Return ordered list of PNM IDs from round
   - Return existing votes for current user in this round

3. **GET /api/sessions/active**:
   - Always return `is_chair` boolean field (currently missing)

4. **POST /api/sessions/{id}/advance**:
   - Ensure it properly cycles through PNMs
   - Handle case when session just started (current_pnm_id is null)

5. **POST /api/votes**:
   - After upserting vote, return updated tallies for that PNM:
     - `yes` count
     - `no` count
     - `unknown` count
     - `favorites` count

### Frontend Fixes

1. **Voting Page**:
   - Show proper empty state when no active session
   - Handle null response from `/sessions/active` gracefully
   - Display join code input when no session

2. **Realtime Updates**:
   - For now, use polling (2-3 second intervals) as simplest solution
   - Or implement WebSocket endpoint (more complex but better)

---

## Step 4: Implementation Plan

### Phase 1: Backend Endpoint Fixes
1. Fix session creation to set first PNM
2. Fix join endpoint to return PNM list and votes
3. Fix active endpoint to return is_chair
4. Fix advance endpoint logic
5. Fix votes endpoint to return tallies

### Phase 2: Frontend Fixes
1. Fix empty state handling
2. Add polling for realtime updates (simplest)
3. Fix session loading logic

### Phase 3: Testing
1. Test session creation as chair
2. Test joining as member
3. Test voting and seeing tallies
4. Test advance functionality
5. Test realtime updates

---

## Step 5: Realtime Strategy

**Simplest Working Solution**: Polling
- Frontend polls `/sessions/{id}/current` every 2-3 seconds
- Backend returns current state
- No WebSocket complexity needed for MVP

**Future Enhancement**: WebSocket
- Add `/ws/sessions/{session_id}` endpoint
- Broadcast on advance and vote events
- More efficient but requires more setup

---

## Files to Modify

### Backend:
- `python_server/routes.py` (lines 1099-1421)
- `python_server/services.py` (SessionService, if needed)

### Frontend:
- `frontend/app/(dashboard)/voting/page.tsx` (lines 179-344)

---

## Summary

**What Works:**
- ✅ Database schema is correct
- ✅ Basic endpoints exist
- ✅ Vote upsert logic works
- ✅ Unique constraint prevents duplicate votes

**What's Broken:**
- ❌ Session creation doesn't initialize current_pnm_id
- ❌ Join endpoint missing PNM list and votes
- ❌ Active endpoint missing is_chair field
- ❌ Votes endpoint doesn't return tallies
- ❌ Frontend shows "Loading..." indefinitely
- ❌ No realtime updates (Supabase Realtime not broadcasting)

**Priority Fixes:**
1. Fix session creation (set first PNM)
2. Fix frontend empty state
3. Add polling for updates
4. Fix vote tallies response
5. Fix join endpoint response

