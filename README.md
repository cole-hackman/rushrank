# RushRank

A fraternity rush management application for organizing and tracking potential new members (PNMs) during rush events.

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth with JWT tokens

## Features

- **PNM Management**: Track potential new members with photos, majors, hometowns, and custom tags
- **Voting System**: Anonymous or open voting with swipe-based interface for live sessions
- **Event Management**: Create events and track PNM attendance with QR code check-in
- **Analytics**: View voting results, rankings, and chapter participation statistics
- **User Roles**: Admin, Executive, and Member roles with appropriate permissions
- **Tag System**: Organize PNMs with custom tags for easy filtering
- **Export**: Download data as CSV for external analysis

## Project Structure

```
rushrank-0.0/
├── frontend/          # Next.js frontend application
├── python_server/     # FastAPI backend server
├── supabase/          # Database schema and migrations
├── docs/              # Documentation and archived notes
└── db/                # Database seed files
```

## Prerequisites

- Node.js v20+
- Python 3.11+
- Supabase account (for database and auth)

## Environment Setup

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Backend (`.env` in project root)

```env
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
MAILERLITE_API_KEY=your-mailerlite-key  # Optional, for email invitations
```

## Running Locally

### 1. Install Dependencies

```bash
# Frontend
cd frontend && npm install

# Backend
pip install -r requirements.txt
# Or with uv:
uv pip install -r requirements.txt
```

### 2. Set Up Database

Apply the schema to your Supabase database:

```bash
# Via Supabase CLI
npx supabase db push

# Or manually run the schema
psql "$DATABASE_URL" -f supabase/schema.sql
```

### 3. Start the Servers

```bash
# Terminal 1: Frontend (port 3000)
cd frontend && npm run dev

# Terminal 2: Backend (port 8000)
python run_fastapi.py
# Or: uvicorn python_server.main:app --reload
```

### 4. Access the App

- Frontend: http://localhost:3000
- API: http://localhost:8000/api
- API Docs: http://localhost:8000/docs

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/me` | Get current user profile |
| GET | `/api/chapters` | List user's chapters |
| GET | `/api/pnms` | List PNMs with filters |
| POST | `/api/pnms` | Create a new PNM |
| GET | `/api/rounds` | List voting rounds |
| POST | `/api/votes` | Submit a vote |
| GET | `/api/events` | List events |
| POST | `/api/events/{id}/attendance` | Check in a PNM |

See `/docs` endpoint for full API documentation.

## Development

### Type Checking

```bash
# Frontend
cd frontend && npm run build

# Backend (Python type hints)
mypy python_server/
```

### Testing

```bash
# Backend tests
pytest python_server/
```

## Deployment

The app is designed to be deployed with:
- **Frontend**: Vercel or any Next.js-compatible host
- **Backend**: Railway, Render, or any Python host
- **Database**: Supabase (managed PostgreSQL)

## License

Private - Beta Theta Pi, Cal Poly SLO
