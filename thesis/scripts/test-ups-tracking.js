require('dotenv').config({ path: '.env.local' });

async function testTracking(trackingNumber) {
  console.log(`📦 Testing UPS Tracking for: ${trackingNumber}\n`);
  
  const clientId = process.env.UPS_CLIENT_ID;
  const clientSecret = process.env.UPS_CLIENT_SECRET;
  const baseUrl = process.env.UPS_API_BASE_URL || 'https://onlinetools.ups.com/api';
  
  if (!clientId || !clientSecret) {
    console.error('❌ UPS credentials not found');
    console.error('   Run: node scripts/test-ups-env.js');
    return;
  }
  
  try {
    // Step 1: Get access token
    console.log('🔐 Step 1: Getting access token...');
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
      throw new Error('Authentication failed: ' + authResponse.statusText);
    }
    
    const authData = await authResponse.json();
    console.log('   ✅ Got access token\n');
    
    // Step 2: Get tracking info
    console.log('📡 Step 2: Fetching tracking information...');
    const trackUrl = `${baseUrl}/track/v1/details/${trackingNumber}`;
    console.log('   URL:', trackUrl);
    
    const trackResponse = await fetch(trackUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json',
        'transId': `test-${Date.now()}`,
        'transactionSrc': 'LogiShop',
      },
    });
    
    console.log('   Status:', trackResponse.status, trackResponse.statusText);
    console.log('');
    
    if (!trackResponse.ok) {
      const errorText = await trackResponse.text();
      
      if (trackResponse.status === 404) {
        console.error('❌ Tracking number not found');
        console.error('');
        console.error('💡 Possible reasons:');
        console.error('   • Invalid tracking number format');
        console.error('   • Tracking number doesn\'t exist in UPS system');
        console.error('   • Using test number with production API');
        console.error('');
        console.error('📝 Valid UPS tracking number format: 1Z + 16 alphanumeric characters');
        console.error('   Example: 1Z999AA10123456784');
      } else {
        console.error('❌ Tracking failed:', trackResponse.status);
        console.error('   Response:', errorText);
      }
      return;
    }
    
    const trackData = await trackResponse.json();
    console.log('✅ Tracking data received!\n');
    
    // Display results
    const shipment = trackData.trackResponse.shipment[0];
    const pkg = shipment.package[0];
    
    console.log('═'.repeat(60));
    console.log('📋 TRACKING RESULTS');
    console.log('═'.repeat(60));
    console.log('');
    console.log('📦 Package Information:');
    console.log('   Tracking Number:', trackingNumber);
    console.log('   Current Status:', pkg.currentStatus.description);
    console.log('   Status Code:', pkg.currentStatus.code);
    console.log('   Service:', pkg.service.description);
    
    if (pkg.deliveryDate) {
      console.log('   Estimated Delivery:', pkg.deliveryDate.date);
    }
    
    if (pkg.weight) {
      console.log('   Weight:', pkg.weight.weight, pkg.weight.unitOfMeasurement);
    }
    
    console.log('');
    console.log('📍 ACTIVITY HISTORY:');
    console.log('─'.repeat(60));
    
    if (pkg.activity && pkg.activity.length > 0) {
      pkg.activity.forEach((activity, index) => {
        const location = [
          activity.location.city,
          activity.location.stateProvince,
          activity.location.country
        ].filter(Boolean).join(', ');
        
        console.log(`\n${index + 1}. ${activity.date} ${activity.time}`);
        console.log(`   📍 ${location || 'Unknown'}`);
        console.log(`   📝 ${activity.status.description}`);
      });
    }
    
    console.log('');
    console.log('═'.repeat(60));
    console.log('');
    
    if (pkg.shipper) {
      console.log('📤 Shipper Information:');
      if (pkg.shipper.name) console.log('   Name:', pkg.shipper.name);
      if (pkg.shipper.address) {
        const shipperLocation = [
          pkg.shipper.address.city,
          pkg.shipper.address.stateProvince,
          pkg.shipper.address.countryCode
        ].filter(Boolean).join(', ');
        if (shipperLocation) console.log('   Location:', shipperLocation);
      }
      console.log('');
    }
    
    if (pkg.shipTo) {
      console.log('📥 Recipient Information:');
      if (pkg.shipTo.name) console.log('   Name:', pkg.shipTo.name);
      if (pkg.shipTo.address) {
        const recipientLocation = [
          pkg.shipTo.address.city,
          pkg.shipTo.address.stateProvince,
          pkg.shipTo.address.countryCode
        ].filter(Boolean).join(', ');
        if (recipientLocation) console.log('   Location:', recipientLocation);
      }
      console.log('');
    }
    
    console.log('🎉 Tracking API is working perfectly!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Restart your app: npm run dev');
    console.log('2. Go to: http://localhost:3000/orders/YOUR_ORDER_ID');
    console.log('3. Add this tracking number');
    console.log('4. Watch it display real-time UPS data!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('💡 If authentication worked but tracking failed:');
    console.error('   • Check tracking number format');
    console.error('   • Try a different tracking number');
    console.error('   • Verify tracking number is active in UPS system');
  }
}

// Usage
const trackingNumber = process.argv[2];

if (!trackingNumber) {
  console.log('❌ Please provide a tracking number\n');
  console.log('Usage:');
  console.log('  node scripts/test-ups-tracking.js YOUR_TRACKING_NUMBER\n');
  console.log('Example:');
  console.log('  node scripts/test-ups-tracking.js 1Z999AA10123456784\n');
  console.log('📝 Valid UPS tracking number format:');
  console.log('   • Starts with "1Z"');
  console.log('   • Followed by 16 alphanumeric characters');
  console.log('   • Total length: 18 characters');
  process.exit(1);
}

testTracking(trackingNumber);
