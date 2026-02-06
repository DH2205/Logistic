# 🔐 Setup Environment Variables

## The Error You're Seeing

```
Your project's URL and Key are required to create a Supabase client!
```

This means your Supabase credentials are missing from `.env.local`.

---

## 🚀 Quick Fix (5 Minutes)

### Step 1: Get Your Supabase Credentials

1. **Go to Supabase Dashboard**  
   https://app.supabase.com

2. **Select Your Project**

3. **Go to Project Settings**
   - Click the ⚙️ gear icon (bottom left)
   - Click **"Settings"**
   - Click **"API"** in the settings menu

4. **Copy These Values:**

   You'll see a section called **"Project API keys"**:

   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public** key (long string starting with `eyJ...`)
   - **service_role** key (another long string starting with `eyJ...`)

---

### Step 2: Update Your `.env.local` File

I've created a `.env.local` file for you at:
```
thesis/.env.local
```

**Open this file** and replace the placeholder values:

```env
# Replace these with your actual values from Supabase:

NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=my-super-secret-jwt-key-at-least-32-chars
```

---

### Step 3: Restart Your Development Server

**IMPORTANT**: Environment variables are only loaded when the server starts!

1. **Stop your current server**
   - In the terminal running `npm run dev`
   - Press `Ctrl+C` (or `Cmd+C` on Mac)

2. **Start it again**
   ```bash
   npm run dev
   ```

3. **Refresh your browser**
   - Go to http://localhost:3000
   - Should work now! ✅

---

## 📋 Visual Guide

### Where to Find Your Credentials:

```
Supabase Dashboard
└── Your Project
    └── ⚙️ Settings (bottom left)
        └── API
            ├── 📍 Project URL: https://xxxxx.supabase.co
            └── 🔑 Project API keys:
                ├── anon public: eyJhbGciOiJI... (COPY THIS)
                └── service_role: eyJhbGciOiJI... (COPY THIS)
```

### What Each Key Does:

| Key | Purpose | Safety |
|-----|---------|--------|
| **NEXT_PUBLIC_SUPABASE_URL** | Your project's URL | ✅ Safe to share |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | Public/anonymous access | ✅ Safe for frontend |
| **SUPABASE_SERVICE_ROLE_KEY** | Full database access | ⚠️ Keep secret! |
| **JWT_SECRET** | Token signing | ⚠️ Keep secret! |

---

## 🧪 Test If It Works

After setting up and restarting:

1. Go to http://localhost:3000
2. Should see your homepage (no errors)
3. Try to register a new account
4. Try to create an order
5. ✅ Should work!

---

## 🔍 Troubleshooting

### Still Getting the Error?

**Check 1: Did you restart the server?**
- You MUST stop and restart `npm run dev`
- Just saving the file is not enough!

**Check 2: Are the values correct?**
- URL should start with `https://`
- Keys should be long strings (100+ characters)
- No quotes around the values
- No spaces

**Check 3: Is the file named correctly?**
- Must be `.env.local` (with the dot!)
- NOT `env.local` or `.env`
- Located in the `thesis/` root folder

**Check 4: Check the file location**
```
thesis/
├── app/
├── components/
├── lib/
├── .env.local  ← Should be here!
└── package.json
```

---

## 📝 Example `.env.local` (Filled Out)

```env
# This is an EXAMPLE - use your actual values!
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmno.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ubyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQwMDAwMDAwLCJleHAiOjE5NTU1NzYwMDB9.abcdefghijklmnopqrstuvwxyz123456789
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ubyIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDAwMDAwMDAsImV4cCI6MTk1NTU3NjAwMH0.abcdefghijklmnopqrstuvwxyz987654321
JWT_SECRET=this-is-my-super-secret-jwt-key-that-is-at-least-32-characters-long
```

---

## ✅ Checklist

- [ ] Opened Supabase Dashboard
- [ ] Went to Settings → API
- [ ] Copied Project URL
- [ ] Copied anon/public key
- [ ] Copied service_role key
- [ ] Updated `.env.local` file
- [ ] Added JWT_SECRET (any secure string)
- [ ] Saved the file
- [ ] Stopped the dev server (Ctrl+C)
- [ ] Started the dev server again (`npm run dev`)
- [ ] Refreshed browser
- [ ] ✅ No more errors!

---

## 🎯 Quick Commands

```bash
# Stop server
Ctrl+C  (or Cmd+C on Mac)

# Start server
npm run dev

# Check if env vars are loaded (optional)
# Add this temporarily to any page to debug:
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
```

---

## ⚠️ Security Note

**NEVER commit `.env.local` to Git!**

It's already in `.gitignore`, but double-check:
```bash
# Should show .env.local is ignored
git status

# If it shows up, add to .gitignore:
echo ".env.local" >> .gitignore
```

---

**After you set this up, your app will work perfectly!** 🚀
