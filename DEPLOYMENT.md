# Deployment Guide for Vercel & Render

This project consists of two parts that should be deployed separately:
1. **Frontend**: Next.js application (deploy to **Vercel**)
2. **Backend**: FastAPI Python server (deploy to **Render**)

---

## 1. Backend Deployment (Render)

We will deploy the backend first so you can get the API URL to provide to the frontend.

### Option A: Using `render.yaml` (Recommended)
I have created a `render.yaml` file in your repository root. This is a Blueprint that tells Render exactly how to build and run your app.

1.  Push your latest code to GitHub.
2.  Go to [dashboard.render.com](https://dashboard.render.com/).
3.  Click **New +** -> **Blueprint**.
4.  Connect your GitHub repository.
5.  Render will detect the `render.yaml` file.
6.  You will be prompted to enter the **Environment Variables** (see list below).
7.  Click **Apply**.

### Option B: Manual Setup
1.  Go to [dashboard.render.com](https://dashboard.render.com/).
2.  Click **New +** -> **Web Service**.
3.  Connect your GitHub repository.
4.  **Settings**:
    *   **Name**: `rushrank-backend` (or similar)
    *   **Root Directory**: (Leave empty, use repo root)
    *   **Runtime**: **Python 3**
    *   **Build Command**: `pip install -r python_server/requirements.txt`
    *   **Start Command**: `uvicorn python_server.main:app --host 0.0.0.0 --port $PORT`
5.  **Environment Variables**:
    *   Add the variables listed below.

### Backend Environment Variables
You need to copy these from your local `.env` or Supabase dashboard:
*   `DATABASE_URL`: Your Supabase PostgreSQL connection string (Mode: Transaction or Session. Transaction is recommended for serverless but Render is a persistent server, so Session is fine, but Supabase usually gives a pooler URL).
*   `SUPABASE_URL`: Your Supabase project URL.
*   `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key (Server-side only!).
*   `ALLOWED_ORIGINS`: The URL of your Vercel frontend (you'll get this in Step 2). For now, you can leave it empty or put `http://localhost:3000`. You **MUST** update this after deploying the frontend.

---

## 2. Frontend Deployment (Vercel)

1.  Push your code to GitHub.
2.  Go to [vercel.com](https://vercel.com) and **Add New Project**.
3.  Import your repository.
4.  **Configure Project**:
    *   **Framework Preset**: Next.js (should be auto-detected).
    *   **Root Directory**: Click `Edit` and select `frontend`. **This is crucial.**
    *   **Build Command**: `next build` (Default)
    *   **Output Directory**: `.next` (Default)
5.  **Environment Variables**:
    *   `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase URL.
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Key (Public).
    *   `NEXT_PUBLIC_API_BASE_URL`: The URL of your **Render Backend** (e.g., `https://rushrank-backend.onrender.com`). The `/api` suffix will be added automatically. **Do not add a trailing slash.**
    *   *Note: `NEXT_PUBLIC_API_URL` is also supported for backwards compatibility.*
    *   *You do **not** need to set a WebSocket URL. The live voting socket is derived from `NEXT_PUBLIC_API_BASE_URL`, because the backend serves `/ws/session/{id}` on the same origin as `/api`. An optional `NEXT_PUBLIC_WS_BASE_URL` overrides it only if you terminate websockets somewhere else.*
6.  Click **Deploy**.

---

## 3. Final Connection

1.  Once Vercel deploys, copy the **Deployment Domain** (e.g., `https://rushrank-frontend.vercel.app`).
2.  Go back to **Render Dashboard** -> **Environment**.
3.  Update (or add) `ALLOWED_ORIGINS` to include your Vercel domain.
    *   Example: `https://rushrank-frontend.vercel.app` (comma-separated if multiple).
4.  **Redeploy** or **Restart** the Render service if necessary (changing env vars usually triggers a restart).

## Troubleshooting

*   **CORS Errors**: If you see CORS errors in the browser console, double-check that `ALLOWED_ORIGINS` on Render exactly matches your Vercel URL (including `https://` and no trailing slash).
*   **Live voting doesn't update across phones**: The session falls back to a 5-second poll whenever the WebSocket is down, so voting still works but tallies lag. Check the browser console for the `/ws/session/...` connection. If it is dialling your *Vercel* domain rather than your Render domain, `NEXT_PUBLIC_API_BASE_URL` is unset in Vercel — the socket URL is derived from it.
*   **Brothers get "Vote not recorded" during a live session**: Rate limits are keyed per authenticated user, but a shared bucket can still be hit if requests arrive unauthenticated. Raise `RATE_LIMIT_VOTES` on Render and confirm the frontend is sending the `Authorization` header.
*   **Database Connection**: Ensure `DATABASE_URL` is correct. If using Supabase, ensure "Allow connections from all IPs" is enabled or Render's IP is allowlisted (allowing all is standard for PaaS).
