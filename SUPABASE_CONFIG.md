# Supabase Configuration Fix

## Problem
The magic link is redirecting to `http://localhost:3000` instead of the correct Replit URL.

## Solution
You need to update the Supabase project settings to use the correct redirect URL.

### Step 1: Get Your Replit URL
Your current Replit URL should be something like:
`https://your-repl-name-username.replit.app`

### Step 2: Update Supabase Settings
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/projects)
2. Select your project: `rodmyhtwsyxcmspaopje`
3. Go to **Authentication** → **URL Configuration**
4. Update the following settings:

**Site URL:**
```
https://your-repl-name-username.replit.app
```

**Redirect URLs:**
```
https://your-repl-name-username.replit.app/**
https://your-repl-name-username.replit.app/auth/callback
https://your-repl-name-username.replit.app/dashboard
```

### Step 3: Test the Fix
1. Try sending a new magic link
2. The email should now contain a link to your Replit URL instead of localhost
3. The authentication should complete successfully

## Alternative Workaround
If you can't access Supabase settings right now, I've created a manual auth handler at `/auth/redirect` that can process the localhost URL and extract the tokens to complete authentication on the Replit site.

## Current Setup
- ✅ Auth handler components created
- ✅ Token processing logic implemented  
- ✅ Redirect flow configured
- ❌ Supabase redirect URL needs updating (requires dashboard access)