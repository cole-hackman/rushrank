# RushRank

A fraternity rush management application that helps chapters organize and track potential new members (PNMs) during rush events.

## 1. What Is the Project?

RushRank is a fraternity rush management application that helps chapters organize and track potential new members (PNMs) during rush events. Users can create rush events, track PNM attendance, manage PNM profiles, and conduct live, anonymous voting sessions to determine bids.

## 2. Why Was This Project Built?

Fraternity recruitment often relies on disorganized spreadsheets, manual vote counting, and scattered notes about potential new members. Important evaluations get lost in the chaos of large rush events, and chapters struggle to make data-driven decisions on who to extend bids to. RushRank provides a structured, centralized platform to make recruitment efficient and organized.

## 3. What Problems Did It Solve?

One major challenge was managing live, anonymous voting for a huge number of PNMs concurrently during selection rounds. This was solved by implementing a heavily optimized, swipe-based voting interface with real-time database updates via FastAPI and Supabase, ensuring the system remains responsive even with the entire chapter voting simultaneously. Additionally, the system tackles the problem of tracking attendance by implementing dynamic QR code generation and scanning, allowing PNMs to check-in easily at the door.

## 4. What Technologies Are Used?

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth with JWT tokens
- **Styling**: Subframe, Radix UI

## 5. What Did You Implement?

- PNM management system with photos, majors, hometowns, and custom tags
- Live voting system with anonymous or open voting and a mobile-friendly swipe interface
- Event management with dynamic QR code creation and scanning for attendance tracking
- Analytics dashboards for viewing voting results, rankings, and chapter participation statistics
- Role-based access control (Admin, Executive, Member)
- Export functionality to download data as CSV for external analysis

## 6. How Can Someone Run It Locally?

### Prerequisites

- Node.js v20+
- Python 3.11+
- Supabase account (for database and auth)

### 1. Environment Setup

Create `.env.local` in the `frontend` directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Create `.env` in the project root:

```env
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
```

### 2. Install Dependencies

```bash
# Frontend
cd frontend && npm install

# Backend
pip install -r requirements.txt
# Or with uv:
uv pip install -r requirements.txt
```

### 3. Set Up Database

Apply the schema to your Supabase database:

```bash
# Via Supabase CLI
npx supabase db push

# Or manually run the schema
psql "$DATABASE_URL" -f supabase/schema.sql
```

### 4. Start the Servers

```bash
# Terminal 1: Frontend (port 3000)
cd frontend && npm run dev

# Terminal 2: Backend (port 8000)
python run_fastapi.py
```

### 5. Access the App

- Frontend: `http://localhost:3000`
- API Docs: `http://localhost:8000/docs`

## License

Private - Beta Theta Pi, Cal Poly SLO
