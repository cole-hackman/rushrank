# Voting Page Reimplementation Guide

## Overview

The voting and results pages have been temporarily hidden from the navigation but the code remains intact. This document explains how to re-enable them when needed.

## Current Status

- **Navigation**: Hidden (conditionally rendered based on `NEXT_PUBLIC_ENABLE_VOTING` environment variable)
  - Both "Voting" and "Results" navigation items are hidden
- **Page Access**: Both pages redirect to home page if accessed directly when disabled
- **Code**: All voting and results functionality remains in place and functional
- **Dashboard Elements Removed**: The following dashboard components have been removed but can be re-added:
  - Active Rounds card (showed count of active voting rounds)
  - Brothers Voted card (showed participation count)
  - Avg Yes Score card (showed average yes percentage)
  - Vote quick action button
  - Results quick action button
  - Active round alert banner
  - Top PNMs section (showed highest scoring candidates)
  - Brother Participation section (showed voting progress)
- **Export Page Elements Removed**: The following export functionality has been removed but can be re-added:
  - Export Round Results section (allowed exporting voting results for rounds as CSV)

## Architecture

The voting system consists of two modes:

### 1. Open Voting (Self-Paced)
- Users vote on PNMs at their own pace
- No session control required
- Votes are stored immediately
- Accessible via `/voting` with "Open Voting" tab

### 2. Live Session (Chair-Controlled)
- Chair creates a session with a join code
- Chair controls which PNM is currently displayed
- Chair can lock/unlock voting
- Chair advances to next PNM
- Real-time updates via WebSocket
- Accessible via `/voting` with "Live Session" tab

## Components

### Frontend Files

- **`frontend/app/(dashboard)/voting/page.tsx`**: Main voting page component
  - Handles both open and session voting modes
  - Integrates WebSocket for real-time updates
  - Drag-to-vote interface for mobile-friendly voting
  - Vote card display matching PNM image design

- **`frontend/app/(dashboard)/results/page.tsx`**: Results page component
  - Displays voting results for completed rounds
  - Shows PNM rankings by yes percentage
  - Filtering and sorting capabilities
  - Export functionality for round results

- **`frontend/hooks/useSessionWebSocket.ts`**: WebSocket hook for live sessions
  - Connects to `/ws/session/{session_id}`
  - Handles reconnection logic
  - Broadcasts: pnm_advance, lock_change, vote_cast, session_ended

### Backend Files

- **`python_server/routes.py`**: Voting endpoints
  - `POST /rounds/open`: Create/ensure open voting round
  - `GET /rounds/open/current`: Get next unvoted PNM
  - `POST /votes`: Cast vote (works for both modes)
  - `POST /sessions`: Create live session
  - `POST /sessions/join`: Join session with code
  - `GET /sessions/{id}/active`: Get active session details
  - `POST /sessions/{id}/lock`: Lock/unlock session (chair only)
  - `POST /sessions/{id}/advance`: Advance to next PNM (chair only)
  - `GET /sessions/{id}/current`: Get current PNM for session
  - `GET /rounds/{id}/status`: Get round status and participation
  - `GET /rounds/{id}/results`: Get voting results for a round (used by Results page)

- **`python_server/main.py`**: WebSocket endpoint
  - `WS /ws/session/{session_id}`: Real-time session updates

- **`python_server/websocket.py`**: WebSocket connection manager
  - Manages active connections per session
  - Broadcasts updates to all connected clients

- **`python_server/services.py`**: Business logic
  - `VotingService`: Round and vote management
  - `SessionService`: Live session management

## Database Schema

### Tables Used

- **`voting_rounds`**: Stores voting rounds
  - `id`, `chapter_id`, `name`, `type` (GENERAL/OPEN), `status`, `settings`, `created_by`
  
- **`round_pnms`**: PNMs included in a round
  - `round_id`, `pnm_id`, `order_index`

- **`votes`**: Individual votes
  - `id`, `round_id`, `pnm_id`, `voter_user_id`, `value` (YES/NO/UNKNOWN), `favorite`, `weight_applied`, `voted_at`

- **`sessions`**: Live voting sessions
  - `id`, `round_id`, `join_code`, `current_pnm_id`, `locked`, `started_at`, `ended_at`

## Re-enabling the Voting Page

### Step 1: Set Environment Variable

Add to `.env.local` (frontend):
```bash
NEXT_PUBLIC_ENABLE_VOTING=true
```

Or set in your deployment environment.

### Step 2: Verify Navigation

Both "Voting" and "Results" navigation items should automatically appear in the main layout when the environment variable is set.

### Step 3: Test Functionality

1. **Open Voting**:
   - Navigate to `/voting`
   - Select "Open Voting" tab
   - Should show next unvoted PNM
   - Test voting (YES/NO/UNKNOWN)
   - Test favorite toggle

2. **Live Session**:
   - Select "Live Session" tab
   - As chair: Create session
   - Share join code with other users
   - Test lock/unlock
   - Test advance to next PNM
   - Verify WebSocket updates work (check for "Live" indicator)

### Step 4: Verify WebSocket Connection

- Check browser console for WebSocket connection logs
- Should see `[WS] Connected to session: {session_id}`
- When chair advances, all connected clients should update automatically
- Fallback polling (5s interval) should activate if WebSocket fails

## Dependencies

### Frontend
- `framer-motion`: Drag animations for voting cards
- `html5-qrcode`: QR code scanning (for event check-in, not voting)
- `useSessionWebSocket`: Custom hook for WebSocket connections

### Backend
- `fastapi`: WebSocket support built-in
- `asyncpg`: Database queries
- `websockets`: WebSocket protocol handling (via FastAPI)

## Known Issues / Considerations

1. **WebSocket Reconnection**: The hook automatically reconnects on disconnect, but may need adjustment for production environments (proxies, load balancers)

2. **Session Timeout**: Sessions don't automatically expire - chair must manually end them

3. **Vote Weighting**: Executive votes can have weighted values (configured in round settings)

4. **Anonymous Voting**: Can be enabled per round via settings

## Testing Checklist

When re-enabling, verify:

- [ ] Navigation items appear (both Voting and Results)
- [ ] Pages load without redirect
- [ ] Open voting shows PNMs correctly
- [ ] Votes are cast and saved
- [ ] Live session creation works
- [ ] Join code sharing works
- [ ] Chair controls (lock/unlock/advance) work
- [ ] WebSocket connects successfully
- [ ] Real-time updates broadcast correctly
- [ ] Fallback polling works if WebSocket fails
- [ ] Vote tallies update correctly
- [ ] Session end redirects to results
- [ ] Results page displays round results correctly
- [ ] Results page filtering and sorting work
- [ ] Results page export functionality works

## Troubleshooting

### WebSocket Not Connecting
- Check backend logs for WebSocket endpoint errors
- Verify CORS settings allow WebSocket connections
- Check browser console for connection errors
- Ensure `WS_BASE_URL` environment variable is set correctly in frontend

### Votes Not Saving
- Check database connection
- Verify user has membership in chapter
- Check round status (must be ACTIVE)
- Review backend logs for vote creation errors

### Session Not Updating
- Verify WebSocket connection status (check "Live" vs "Polling" indicator)
- Check backend logs for broadcast errors
- Verify session exists and is active
- Check chair permissions

## Future Enhancements

Potential improvements when re-implementing:

1. **Session Timer**: Auto-advance after timer expires
2. **Vote History**: Show voting history per user
3. **Analytics**: Real-time voting analytics during session
4. **Mobile Optimization**: Improve drag gestures on mobile
5. **Offline Support**: Queue votes when offline, sync when reconnected

## Code Locations Summary

- **Frontend Voting Page**: `frontend/app/(dashboard)/voting/page.tsx`
- **Frontend Results Page**: `frontend/app/(dashboard)/results/page.tsx`
- **WebSocket Hook**: `frontend/hooks/useSessionWebSocket.ts`
- **Backend Routes**: `python_server/routes.py` (lines ~1198-1850)
- **WebSocket Manager**: `python_server/websocket.py`
- **WebSocket Endpoint**: `python_server/main.py` (line ~80)
- **Voting Service**: `python_server/services.py` (VotingService class)
- **Session Service**: `python_server/services.py` (SessionService class)
- **Navigation**: `frontend/app/(dashboard)/layout.tsx` (lines ~82-90)

## Dashboard Elements Removed

The following dashboard components were removed but can be re-added when voting is re-enabled:

### Removed Components

1. **Active Rounds Card** - Displayed count of active voting rounds
   - Location: Dashboard stats grid (second card)
   - Data: `activeRound` state, fetched from `/rounds?chapter_id={id}`

2. **Brothers Voted Card** - Showed participation count (X/Y brothers voted)
   - Location: Dashboard stats grid (third card)
   - Data: `brothersVoted` and `totalBrothers` state, from `/rounds/{id}/status`

3. **Avg Yes Score Card** - Displayed average yes percentage
   - Location: Dashboard stats grid (fourth card)
   - Data: `avgYesScore` state, calculated from `/rounds/{id}/results`

4. **Vote Quick Action Button** - Quick link to voting page
   - Location: Quick Actions section
   - Action: Navigated to `/voting`

5. **Results Quick Action Button** - Quick link to results page
   - Location: Quick Actions section
   - Action: Navigated to `/results`

6. **Active Round Alert Banner** - Alert showing active round and timer
   - Location: Top of dashboard
   - Data: `activeRound` and `roundStatus` state

7. **Top PNMs Section** - Displayed highest scoring candidates
   - Location: Below stats cards
   - Data: `topPnms` state, from `/rounds/{id}/results` sorted by `yes_percentage`

8. **Brother Participation Section** - Showed voting progress with avatars
   - Location: Below Top PNMs section
   - Data: `votedUsers` and participation percentage

### How to Re-Add

To re-add these elements when voting is re-enabled:

1. **Restore State Variables** (in `frontend/app/(dashboard)/page.tsx`):
   ```typescript
   const [activeRound, setActiveRound] = useState<Round | null>(null);
   const [roundStatus, setRoundStatus] = useState<RoundStatus | null>(null);
   const [topPnms, setTopPnms] = useState<PNM[]>([]);
   const [brothersVoted, setBrothersVoted] = useState(0);
   const [totalBrothers, setTotalBrothers] = useState(0);
   const [avgYesScore, setAvgYesScore] = useState(0);
   const [previousAvgYes, setPreviousAvgYes] = useState(0);
   const [votedUsers, setVotedUsers] = useState<User[]>([]);
   ```

2. **Restore Data Loading** (in `loadDashboardData` function):
   - Find active round from rounds data
   - Fetch round status from `/rounds/{id}/status`
   - Fetch round results from `/rounds/{id}/results`
   - Calculate top PNMs and average yes score
   - Fetch voted users list

3. **Restore UI Components**:
   - Add back the three stat cards (Active Rounds, Brothers Voted, Avg Yes Score)
   - Add back the alert banner for active rounds
   - Add back the Top PNMs section
   - Add back the Brother Participation section
   - Add back Vote and Results buttons in Quick Actions

4. **Restore Helper Functions**:
   - `getRoundName()` - Format round name for display
   - `getTimeRemaining()` - Calculate timer from round status
   - Update `handleQuickAction()` to handle "vote" and "results" cases

5. **Restore Type Definitions**:
   ```typescript
   type PNM = { id: string; name: string; major?: string | null; photo_url?: string | null; yes_percentage?: number | null; };
   type RoundStatus = { round_id: string; status: string; votes_collected: number; total_voters: number; timer_remaining?: number; };
   type User = { id: string; name?: string | null; email?: string | null; photo_url?: string | null; };
   ```

6. **Restore Imports**:
   - `Alert` component
   - `Avatar` component
   - `Button` component
   - `Progress` component
   - Feather icons: `ArrowUp`, `BarChart`, `CheckSquare`, `Clock`, `Eye`, `UserCheck`

### Git History Reference

The original implementation can be found in git history. Search for commits before the dashboard cleanup to see the full implementation.

## PNM Page Elements Removed

The following PNM page components were removed but can be re-added when voting is re-enabled:

### Removed Stat Cards

1. **Avg Yes % Card** - Displayed average yes percentage across all PNMs
   - Location: PNM stats grid (second card)
   - Icon: `FeatherTrendingUp`
   - Data: Calculated from `pnms.reduce((sum, p) => sum + (p.yes_percentage || 0), 0) / total`

2. **Favorites Card** - Showed count of PNMs marked as favorites
   - Location: PNM stats grid (third card)
   - Icon: `FeatherStar`
   - Data: `pnms.filter((p) => (p.is_favorite || (p.favorite_count || 0) > 0)).length`

3. **Controversial Card** - Showed PNMs with yes% between 40-60%
   - Location: PNM stats grid (fourth card)
   - Icon: `FeatherAlertTriangle`
   - Data: `pnms.filter((p) => (p.yes_percentage ?? 0) >= 40 && (p.yes_percentage ?? 0) <= 60).length`

### Removed Table Columns

1. **Yes % Column** - Progress bar with percentage display
   - Header Cell: `<Table.HeaderCell>Yes %</Table.HeaderCell>`
   - Body Cell: Progress component with color-coded percentage text

2. **Favorites Column** - Display of favorite count per PNM
   - Header Cell: `<Table.HeaderCell>Favorites</Table.HeaderCell>`
   - Body Cell: `{pnm.favorite_count ?? 0}`

### How to Re-Add

To re-add these elements when voting is re-enabled:

1. **Restore Imports** (in `frontend/app/(dashboard)/pnms/page.tsx`):
   ```typescript
   import { FeatherStar } from "@subframe/core";
   import { FeatherTrendingUp } from "@subframe/core";
   import { Progress } from "@/ui/components/Progress";
   ```

2. **Restore Stats Calculation**:
   ```typescript
   const stats = useMemo(() => {
     const total = pnms.length;
     const avgYes = total > 0
       ? Math.round(pnms.reduce((sum, p) => sum + (p.yes_percentage || 0), 0) / total)
       : 0;
     const favorites = pnms.filter((p) => (p.is_favorite || (p.favorite_count || 0) > 0)).length;
     const controversial = pnms.filter(
       (p) => (p.yes_percentage ?? 0) >= 40 && (p.yes_percentage ?? 0) <= 60
     ).length;
     return { total, avgYes, favorites, controversial };
   }, [pnms]);
   ```

3. **Restore formatPercent Helper**:
   ```typescript
   const formatPercent = (value?: number) =>
     typeof value === "number" ? `${Math.round(value)}%` : "—";
   ```

4. **Restore Stat Cards**:
   - Add back `Avg Yes %`, `Favorites`, and `Controversial` StatCard components

5. **Restore Table Columns**:
   - Add header cells for `Yes %` and `Favorites`
   - Add body cells with Progress component and favorite count
   - Update `colSpan` calculation for empty state row

## Contact

For questions about the voting implementation, refer to the code comments in the files listed above or check the git history for implementation details.
