# ✅ UPDATE YOUR .env.local FILE

## 🔧 Quick Fix

Your `.env.local` file is missing the base URL. Add this line:

```bash
UPS_API_BASE_URL=https://onlinetools.ups.com
```

---

## 📝 How to Update:

### Option 1: Add via Command Line (Easiest)

```bash
echo "UPS_API_BASE_URL=https://onlinetools.ups.com" >> .env.local
```

### Option 2: Edit Manually

1. Open `.env.local` in your editor
2. Add this line at the end:
   ```
   UPS_API_BASE_URL=https://onlinetools.ups.com
   ```
3. Save the file

---

## ✅ Your Complete .env.local Should Look Like:

```bash
UPS_CLIENT_ID=lGTc3FQtqK...
UPS_CLIENT_SECRET=...
UPS_API_BASE_URL=https://onlinetools.ups.com
```

---

## 🧪 Verify It's Added:

```bash
# Check the file contents
cat .env.local

# Or on Windows:
type .env.local
```

Should show all three lines!

---

## 🎯 Then Test Again:

```bash
node scripts/ups-track.js 1ZB8678F6726882401
```

Should work now! ✅
