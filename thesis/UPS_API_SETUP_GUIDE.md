# 🚀 UPS Tracking API Setup Guide

## 📋 Prerequisites

You mentioned you already have:
- ✅ UPS Client ID
- ✅ UPS Client Secret

Great! Let's get it working.

---

## Step 1: Add UPS Credentials to Environment Variables

### Option A: Using .env.local (Recommended)

1. **Open or create** `.env.local` file in your project root:
   ```
   ProjectL/thesis/.env.local
   ```

2. **Add these variables:**

```bash
# UPS API Configuration
UPS_CLIENT_ID=your_actual_client_id_here
UPS_CLIENT_SECRET=your_actual_client_secret_here
UPS_ACCOUNT_NUMBER=your_ups_account_number_here
UPS_API_BASE_URL=https://onlinetools.ups.com/api

# For Production UPS API, use:
# UPS_API_BASE_URL=https://onlinetools.ups.com/api

# For Testing/Sandbox UPS API, use:
# UPS_API_BASE_URL=https://wwwcie.ups.com/api
```

### Example:
```bash
UPS_CLIENT_ID=ABC123XYZ456DEF789GHI012JKL345MNO678PQR
UPS_CLIENT_SECRET=aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890
UPS_ACCOUNT_NUMBER=A1B2C3
UPS_API_BASE_URL=https://onlinetools.ups.com/api
```

---

## Step 2: Verify Environment Variables

Create a test file to check if variables are loaded:

**File:** `scripts/test-ups-env.js`

```javascript
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Checking UPS Environment Variables:\n');
console.log('UPS_CLIENT_ID:', process.env.UPS_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('UPS_CLIENT_SECRET:', process.env.UPS_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
console.log('UPS_ACCOUNT_NUMBER:', process.env.UPS_ACCOUNT_NUMBER ? '✅ Set' : '❌ Missing');
console.log('UPS_API_BASE_URL:', process.env.UPS_API_BASE_URL || '❌ Missing');

if (process.env.UPS_CLIENT_ID && process.env.UPS_CLIENT_SECRET) {
  console.log('\n✅ UPS credentials are configured!');
} else {
  console.log('\n❌ UPS credentials are missing. Please add them to .env.local');
}
```

**Run it:**
```bash
node scripts/test-ups-env.js
```

**Expected Output:**
```
🔍 Checking UPS Environment Variables:

UPS_CLIENT_ID: ✅ Set
UPS_CLIENT_SECRET: ✅ Set
UPS_ACCOUNT_NUMBER: ✅ Set
UPS_API_BASE_URL: https://onlinetools.ups.com/api

✅ UPS credentials are configured!
```

---

## Step 3: Understanding UPS API Endpoints

### Authentication (OAuth 2.0)
```
POST https://onlinetools.ups.com/api/security/v1/oauth/token
Authorization: Basic base64(clientId:clientSecret)
Content-Type: application/x-www-form-urlencoded

Body: grant_type=client_credentials
```

### Tracking API
```
GET https://onlinetools.ups.com/api/track/v1/details/{trackingNumber}
Authorization: Bearer {access_token}
transId: unique-transaction-id
transactionSrc: your-app-name
```

---

## Step 4: Test UPS API Connection

Create a test script to verify API access:

**File:** `scripts/test-ups-api.js`

```javascript
require('dotenv').config({ path: '.env.local' });

async function testUPSAuth() {
  console.log('🔐 Testing UPS Authentication...\n');
  
  const clientId = process.env.UPS_CLIENT_ID;
  const clientSecret = process.env.UPS_CLIENT_SECRET;
  const baseUrl = process.env.UPS_API_BASE_URL || 'https://onlinetools.ups.com/api';
  
  if (!clientId || !clientSecret) {
    console.error('❌ UPS credentials not found in environment variables');
    return;
  }
  
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    console.log('📡 Requesting access token from UPS...');
    const response = await fetch(`${baseUrl}/security/v1/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Authentication failed:', response.status, response.statusText);
      console.error('Response:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('✅ Authentication successful!');
    console.log('Access Token:', data.access_token.substring(0, 20) + '...');
    console.log('Token Type:', data.token_type);
    console.log('Expires In:', data.expires_in, 'seconds');
    console.log('\n🎉 UPS API is ready to use!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testUPSAuth();
```

**Run it:**
```bash
node scripts/test-ups-api.js
```

**Expected Output:**
```
🔐 Testing UPS Authentication...

📡 Requesting access token from UPS...
✅ Authentication successful!
Access Token: eyJraWQiOiI1NGQwNzg...
Token Type: Bearer
Expires In: 14400 seconds

🎉 UPS API is ready to use!
```

---

## Step 5: Test Tracking API with Real Data

**File:** `scripts/test-ups-tracking.js`

```javascript
require('dotenv').config({ path: '.env.local' });

async function testTracking(trackingNumber) {
  console.log(`📦 Testing UPS Tracking for: ${trackingNumber}\n`);
  
  const clientId = process.env.UPS_CLIENT_ID;
  const clientSecret = process.env.UPS_CLIENT_SECRET;
  const baseUrl = process.env.UPS_API_BASE_URL || 'https://onlinetools.ups.com/api';
  
  try {
    // Step 1: Get access token
    console.log('🔐 Getting access token...');
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const authResponse = await fetch(`${baseUrl}/security/v1/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    
    if (!authResponse.ok) {
      throw new Error('Authentication failed');
    }
    
    const authData = await authResponse.json();
    console.log('✅ Got access token\n');
    
    // Step 2: Get tracking info
    console.log('📡 Fetching tracking information...');
    const trackResponse = await fetch(
      `${baseUrl}/track/v1/details/${trackingNumber}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authData.access_token}`,
          'Content-Type': 'application/json',
          'transId': `test-${Date.now()}`,
          'transactionSrc': 'LogiShop',
        },
      }
    );
    
    if (!trackResponse.ok) {
      const errorText = await trackResponse.text();
      throw new Error(`Tracking failed: ${trackResponse.status} ${errorText}`);
    }
    
    const trackData = await trackResponse.json();
    console.log('✅ Tracking data received!\n');
    
    // Display results
    const shipment = trackData.trackResponse.shipment[0];
    const pkg = shipment.package[0];
    
    console.log('📋 TRACKING RESULTS');
    console.log('═'.repeat(50));
    console.log('Tracking Number:', trackingNumber);
    console.log('Status:', pkg.currentStatus.description);
    console.log('Delivery Date:', pkg.deliveryDate?.date || 'Not available');
    console.log('Service:', pkg.service.description);
    console.log('\n📍 LATEST ACTIVITY:');
    if (pkg.activity && pkg.activity.length > 0) {
      const latest = pkg.activity[0];
      console.log('Time:', latest.date, latest.time);
      console.log('Location:', [
        latest.location.city,
        latest.location.stateProvince,
        latest.location.country
      ].filter(Boolean).join(', '));
      console.log('Status:', latest.status.description);
    }
    
    console.log('\n🎉 Tracking API is working perfectly!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Usage: node scripts/test-ups-tracking.js 1Z999AA10123456784
const trackingNumber = process.argv[2] || '1Z999AA10123456784';
testTracking(trackingNumber);
```

**Run it:**
```bash
# Test with a valid UPS tracking number
node scripts/test-ups-tracking.js 1Z999AA10123456784

# Or with your own tracking number
node scripts/test-ups-tracking.js YOUR_TRACKING_NUMBER
```

---

## Step 6: Restart Your Application

After adding environment variables, restart your Next.js server:

```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev
```

---

## Step 7: Verify Integration in Your App

### A. Check Order Detail Page

1. Go to: `http://localhost:3000/orders/YOUR_ORDER_ID`
2. Add a real UPS tracking number
3. The tracking widget should now show **REAL data from UPS**!

### B. Watch the Console

In your terminal (where `npm run dev` is running), you should see:

```
✅ UPS API authentication successful
📡 Fetching tracking data for: 1Z999AA10123456784
✅ Tracking data received from UPS
```

### C. Check Browser Console

Press F12 → Console tab. You should see:

```javascript
UPS Tracking Data: {
  trackingNumber: "1Z999AA10123456784",
  carrier: "UPS",
  status: "IT",
  statusDescription: "In Transit",
  estimatedDelivery: "2024-12-25",
  currentLocation: "Chicago, IL, US",
  activities: [...]
}
```

---

## Step 8: Understanding the Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                  YOUR WEB APP                           │
└─────────────────────────────────────────────────────────┘
                           │
                           │ 1. User views order
                           ▼
┌─────────────────────────────────────────────────────────┐
│          Frontend: app/orders/[id]/page.tsx             │
│  - Shows TrackingDisplay component                      │
└─────────────────────────────────────────────────────────┘
                           │
                           │ 2. Component fetches tracking
                           ▼
┌─────────────────────────────────────────────────────────┐
│      API: app/api/orders/[id]/tracking/route.ts        │
│  - Calls upsTrackingService.trackShipment()             │
└─────────────────────────────────────────────────────────┘
                           │
                           │ 3. Service makes UPS API calls
                           ▼
┌─────────────────────────────────────────────────────────┐
│          Service: backend/lib/ups-tracking.ts                   │
│  - Authenticates with UPS OAuth                         │
│  - Fetches tracking data                                │
│  - Transforms response                                  │
└─────────────────────────────────────────────────────────┘
                           │
                           │ 4. Calls UPS API
                           ▼
┌─────────────────────────────────────────────────────────┐
│              UPS TRACKING API                           │
│  https://onlinetools.ups.com/api                        │
│  - OAuth: /security/v1/oauth/token                      │
│  - Tracking: /track/v1/details/{trackingNumber}         │
└─────────────────────────────────────────────────────────┘
                           │
                           │ 5. Returns real-time data
                           ▼
┌─────────────────────────────────────────────────────────┐
│         Your Frontend Shows Live Data                   │
│  ✅ Current Status                                      │
│  ✅ Location                                            │
│  ✅ Activity History                                    │
│  ✅ Estimated Delivery                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Step 9: Troubleshooting

### Problem 1: "UPS authentication failed"

**Possible Causes:**
- Wrong Client ID or Secret
- Credentials not in .env.local
- Using sandbox URL with production credentials

**Solution:**
```bash
# Check credentials
node scripts/test-ups-env.js

# Verify with UPS Developer Portal:
# https://developer.ups.com/apps
```

### Problem 2: "Tracking number not found"

**Possible Causes:**
- Invalid tracking number format
- Tracking number doesn't exist in UPS system
- Using test number with production API

**Solution:**
```javascript
// Validate format first
const isValid = /^1Z[A-Z0-9]{16}$/.test(trackingNumber);

// For testing, use a real active tracking number
```

### Problem 3: "401 Unauthorized"

**Possible Causes:**
- Token expired
- Invalid credentials
- Missing authorization header

**Solution:**
The service handles token refresh automatically. If issue persists:
```bash
# Clear token cache by restarting server
Ctrl+C
npm run dev
```

### Problem 4: Still showing mock data

**Check:**
```javascript
// In your console, look for:
console.log('Using UPS credentials:', !!process.env.UPS_CLIENT_ID);

// Should be: true
// If false, credentials not loaded
```

**Solution:**
1. Restart Next.js server
2. Verify .env.local is in correct location
3. Check file is not .env.local.txt

---

## Step 10: Production Deployment

### For Vercel/Netlify:

1. **Go to your deployment dashboard**
2. **Navigate to Environment Variables**
3. **Add:**
   ```
   UPS_CLIENT_ID = your_value
   UPS_CLIENT_SECRET = your_value
   UPS_ACCOUNT_NUMBER = your_value
   UPS_API_BASE_URL = https://onlinetools.ups.com/api
   ```
4. **Redeploy**

### For Other Platforms:

Add environment variables according to platform docs.

---

## 🎯 Quick Checklist

Before testing, make sure:

- [ ] Added UPS_CLIENT_ID to .env.local
- [ ] Added UPS_CLIENT_SECRET to .env.local
- [ ] Added UPS_ACCOUNT_NUMBER to .env.local
- [ ] Added UPS_API_BASE_URL to .env.local
- [ ] Restarted Next.js server
- [ ] Tested authentication (scripts/test-ups-api.js)
- [ ] Tested tracking (scripts/test-ups-tracking.js)
- [ ] Added real tracking number to an order
- [ ] Verified tracking widget shows real data

---

## 📊 Expected Results

### ✅ Working Integration

**What you'll see:**
- Real-time tracking status
- Accurate location updates
- Activity history from UPS
- Estimated delivery dates
- Shipper and recipient info
- Package weight and service type

**In the UI:**
```
┌──────────────────────────────────────────┐
│ 📦 UPS Tracking                          │
├──────────────────────────────────────────┤
│ Status: In Transit                       │
│ Current Location: Chicago, IL, US        │
│ Estimated Delivery: Dec 25, 2024        │
│                                          │
│ 📍 Activity History:                     │
│ • Dec 20, 10:30 AM - Chicago, IL         │
│   Package in transit                     │
│ • Dec 20, 6:00 AM - New York, NY        │
│   Departed from facility                 │
│ • Dec 19, 2:00 PM - New York, NY        │
│   Origin scan                            │
└──────────────────────────────────────────┘
```

---

## 🚀 Next Steps

After UPS API is working:

1. **Add automatic refresh**
   - Tracking data updates every 5 minutes
   - Already implemented in TrackingDisplay component

2. **Add email notifications**
   - Notify customers on status changes
   - Requires email service setup

3. **Add multiple carriers**
   - FedEx API
   - DHL API
   - USPS API

4. **Analytics**
   - Track delivery times
   - Monitor shipping performance
   - Generate reports

---

## 📚 Resources

### UPS Developer Portal
- **Dashboard:** https://developer.ups.com/apps
- **API Docs:** https://developer.ups.com/api/reference/tracking
- **Support:** https://developer.ups.com/support

### Your Implementation
- **Service:** `backend/lib/ups-tracking.ts`
- **API Route:** `app/api/orders/[id]/tracking/route.ts`
- **Component:** `frontend/components/tracking/TrackingDisplay.tsx`

---

## 🆘 Need Help?

If you encounter issues:

1. **Check environment variables:**
   ```bash
   node scripts/test-ups-env.js
   ```

2. **Test authentication:**
   ```bash
   node scripts/test-ups-api.js
   ```

3. **Test tracking:**
   ```bash
   node scripts/test-ups-tracking.js YOUR_TRACKING_NUMBER
   ```

4. **Check server logs:**
   Look for errors in your terminal where `npm run dev` is running

---

**You're all set! 🎉 Your UPS tracking integration is ready to go live!**
