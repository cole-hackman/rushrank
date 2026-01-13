# 🚀 RushRank Quick Start Guide

## The Problem You Hit

You got `ModuleNotFoundError: No module named 'uvicorn'` because:
- You installed `uvicorn` globally with `pip install uvicorn`
- But `python3` was looking in a different Python installation
- Python has multiple environments, and they don't share packages

## ✅ The Fix: Use Virtual Environment

A virtual environment isolates your project's Python dependencies.

---

## 🎯 **Quick Start (2 Commands)**

### **Backend (Terminal 1)**
```bash
cd /Users/coleh/rushrank-0.0

# Easy mode: use the script I created
./start_backend.sh
```

OR manually:
```bash
# Activate virtual environment
source venv/bin/activate

# Run the server
python START_FASTAPI.py
```

**Backend will start on:** http://localhost:8000

---

### **Frontend (Terminal 2)**
```bash
cd /Users/coleh/rushrank-0.0/frontend

# Start Next.js dev server
npm run dev
```

**Frontend will start on:** http://localhost:3000

---

## 🔧 **First-Time Setup**

Only need to do this once:

### 1. Backend Setup
```bash
cd /Users/coleh/rushrank-0.0

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Install dependencies
pip install -r python_server/requirements.txt
```

### 2. Frontend Setup
```bash
cd /Users/coleh/rushrank-0.0/frontend

# Install dependencies (already done)
npm install
```

### 3. Environment Variables

**Backend** - Set these in your shell or Replit Secrets:
```bash
export DATABASE_URL="postgresql://user:pass@host:5432/db"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export SUPABASE_JWKS_URL="https://your-project.supabase.co/auth/v1/jwks"
```

**Frontend** - Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 💡 **Why Virtual Environments?**

**Without venv (what you tried):**
```bash
pip install uvicorn        # Installs to system Python
python3 START_FASTAPI.py   # Looks in different Python → fails
```

**With venv (proper way):**
```bash
source venv/bin/activate   # Switches to project Python
pip install uvicorn        # Installs to venv
python START_FASTAPI.py    # Finds uvicorn → works! ✅
```

---

## 🎯 **Daily Workflow**

Every time you start working:

### Terminal 1 - Backend
```bash
cd /Users/coleh/rushrank-0.0
./start_backend.sh
```

### Terminal 2 - Frontend
```bash
cd /Users/coleh/rushrank-0.0/frontend
npm run dev
```

That's it!

---

## 🐛 **Troubleshooting**

### "ModuleNotFoundError" (again?)
**Fix:** Make sure you activated venv:
```bash
source venv/bin/activate
# You should see (venv) in your prompt
```

### "Permission denied: ./start_backend.sh"
**Fix:** Make it executable:
```bash
chmod +x start_backend.sh
```

### Backend won't start
**Fix:** Check environment variables:
```bash
source venv/bin/activate
python -c "import os; print('DATABASE_URL:', os.getenv('DATABASE_URL'))"
```

### Frontend can't connect to backend
**Fix:** Verify backend is running:
```bash
curl http://localhost:8000/health
```

---

## 📋 **Verify Everything Works**

### 1. Check Backend
```bash
curl http://localhost:8000/api/health
# Should return: {"status":"healthy","version":"2.0.0"}
```

### 2. Check Frontend
Open browser: http://localhost:3000

Expected pages:
- `/login` - Login page
- `/` - Dashboard (after login)
- `/pnms` - PNM table
- `/voting` - Voting interface
- `/intake` - PNM intake form

---

## 🎉 **You're Ready!**

Now test the full flow:
1. Go to `/intake` and create a PNM
2. Check `/pnms` to see it in the table
3. Try filtering by tags
4. Click a PNM to see profile
5. Go to `/voting` and vote on PNMs

---

## 📝 **Pro Tips**

1. **Keep Terminal 1 running** for backend logs
2. **Keep Terminal 2 running** for frontend hot-reload
3. **Use `Ctrl+C`** to stop either server
4. **Check logs** if something breaks - they're helpful!

---

## 🔑 **Environment Setup Checklist**

- [ ] Virtual environment created (`venv/` folder exists)
- [ ] Dependencies installed (run `pip list` in venv)
- [ ] Backend env vars set (DATABASE_URL, SUPABASE_URL, etc.)
- [ ] Frontend `.env.local` created
- [ ] Backend starts on port 8000
- [ ] Frontend starts on port 3000
- [ ] Can access both in browser

---

**Need help?** Check `FRONTEND_SETUP.md` for more details!

