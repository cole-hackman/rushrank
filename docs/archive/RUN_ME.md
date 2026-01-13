# 🎯 HOW TO RUN RUSHRANK

## The Issue You Had

```bash
python3 START_FASTAPI.py
# ❌ ModuleNotFoundError: No module named 'uvicorn'
```

**Why?** Python couldn't find uvicorn because you need to use a virtual environment.

---

## ✅ THE FIX (Copy & Paste These Commands)

### **Step 1: Start Backend**

Open a terminal and run:

```bash
cd /Users/coleh/rushrank-0.0
source venv/bin/activate
python START_FASTAPI.py
```

You should see:
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

✅ **Backend is now running on http://localhost:8000**

---

### **Step 2: Start Frontend**

Open a **NEW terminal** and run:

```bash
cd /Users/coleh/rushrank-0.0/frontend
npm run dev
```

You should see:
```
▲ Next.js 14.2.15
- Local:        http://localhost:3000
✓ Ready in 2.1s
```

✅ **Frontend is now running on http://localhost:3000**

---

## 🌐 **Test It Works**

1. **Backend Health Check:**
   ```bash
   curl http://localhost:8000/health
   ```
   Should return: `{"message":"RushRank API v2.0 - Powered by FastAPI + Supabase"}`

2. **Frontend:**
   Open browser: http://localhost:3000
   - You should see the login page or dashboard

---

## 🔑 **Important Notes**

### Backend Terminal
- Must have `(venv)` at the start of your prompt
- If you don't see it, run: `source venv/bin/activate`

### Frontend Terminal
- Just needs Node.js (no special setup)

### Stopping Servers
- Press `Ctrl+C` in each terminal to stop

---

## 🎨 **What You'll See**

Once both are running, visit http://localhost:3000:

- **Login Page** → Enter credentials
- **Dashboard** → Stats cards (Total PNMs, Active Rounds, etc.)
- **PNMs** → Table with search, tag filters, favorites
- **Voting** → Tinder-style swipe with round status sidebar
- **Results** → Ranked results with statistics
- **Intake** → Beautiful form to add PNMs

---

## 🐛 **Common Issues**

### Backend: "DATABASE_URL environment variable not set"
```bash
export DATABASE_URL="postgresql://user:pass@host:5432/db"
```

### Frontend: "Failed to load PNMs"
- Check backend is running on port 8000
- Check `frontend/.env.local` has correct API URL:
  ```env
  NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
  ```

### "Port already in use"
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

---

## 📝 **Daily Workflow**

Every time you code:

```bash
# Terminal 1 (Backend)
cd /Users/coleh/rushrank-0.0
source venv/bin/activate
python START_FASTAPI.py

# Terminal 2 (Frontend)  
cd /Users/coleh/rushrank-0.0/frontend
npm run dev
```

**Pro tip:** Save these as shell aliases or use the `start_backend.sh` script!

---

## ✨ **You're All Set!**

Your RushRank app should now be running with:
- ✅ 21st.dev components (Aceternity Sidebar, Ruixen Table, etc.)
- ✅ Subframe-inspired designs (Voting view, Results, PNM profiles)
- ✅ Full backend integration
- ✅ Realtime updates
- ✅ Tag filtering
- ✅ Beautiful UI

**Happy coding! 🎉**

