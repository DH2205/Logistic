#!/usr/bin/env node
/**
 * UPS Tracking Terminal Tool
 * Usage: node scripts/ups-track.js TRACKING_NUMBER
 */

require('dotenv').config({ path: '.env.local' });

async function trackPackage(trackingNumber) {
  console.log('\n' + '═'.repeat(70));
  console.log(`📦 UPS PACKAGE TRACKING: ${trackingNumber}`);
  console.log('═'.repeat(70) + '\n');
  
  const clientId = process.env.UPS_CLIENT_ID;
  const clientSecret = process.env.UPS_CLIENT_SECRET;
  const baseUrl = process.env.UPS_API_BASE_URL || 'https://onlinetools.ups.com';
  
  // Validate credentials
  if (!clientId || !clientSecret) {
    console.error('❌ Error: UPS credentials not found in .env.local\n');
    console.log('Please add these to your .env.local file:');
    console.log('   UPS_CLIENT_ID=your_client_id');
    console.log('   UPS_CLIENT_SECRET=your_client_secret\n');
    return;
  }
  
  try {
    // Step 1: Authenticate
    console.log('🔐 Authenticating with UPS...');
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
      const errorText = await authResponse.text();
      console.error('❌ Authentication failed:', authResponse.status);
      console.error('Response:', errorText);
      return;
    }
    
    const authData = await authResponse.json();
    console.log('✅ Authenticated\n');
    
    // Step 2: Get tracking data
    console.log('📡 Fetching tracking information...');
    const trackResponse = await fetch(
      `${baseUrl}/api/track/v1/details/${trackingNumber}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authData.access_token}`,
          'Content-Type': 'application/json',
          'transId': `track-${Date.now()}`,
          'transactionSrc': 'LogiShop',
        },
      }
    );
    
    if (!trackResponse.ok) {
      if (trackResponse.status === 404) {
        console.error('\n❌ Tracking number not found\n');
        console.log('💡 Please check:');
        console.log('   • Tracking number is correct');
        console.log('   • Format: 1Z followed by 16 characters (total 18)');
        console.log('   • Example: 1Z999AA10123456784\n');
      } else {
        const errorText = await trackResponse.text();
        console.error('❌ Tracking failed:', trackResponse.status);
        console.error('Response:', errorText);
      }
      return;
    }
    
    const trackData = await trackResponse.json();
    const shipment = trackData.trackResponse.shipment[0];
    const pkg = shipment.package[0];
    
    // Display results
    console.log('✅ Data received\n');
    
    console.log('═'.repeat(70));
    console.log('📋 PACKAGE STATUS');
    console.log('═'.repeat(70));
    console.log(`Status:             ${pkg.currentStatus.description}`);
    console.log(`Service:            ${pkg.service.description}`);
    
    if (pkg.deliveryDate) {
      console.log(`Estimated Delivery: ${pkg.deliveryDate.date}`);
    }
    
    if (pkg.weight) {
      console.log(`Weight:             ${pkg.weight.weight} ${pkg.weight.unitOfMeasurement}`);
    }
    
    // Shipper info
    if (pkg.shipper) {
      console.log('\n📤 SHIPPED FROM:');
      if (pkg.shipper.name) {
        console.log(`   ${pkg.shipper.name}`);
      }
      if (pkg.shipper.address) {
        const location = [
          pkg.shipper.address.city,
          pkg.shipper.address.stateProvince,
          pkg.shipper.address.countryCode
        ].filter(Boolean).join(', ');
        if (location) console.log(`   ${location}`);
      }
    }
    
    // Recipient info
    if (pkg.shipTo) {
      console.log('\n📥 SHIPPING TO:');
      if (pkg.shipTo.name) {
        console.log(`   ${pkg.shipTo.name}`);
      }
      if (pkg.shipTo.address) {
        const location = [
          pkg.shipTo.address.city,
          pkg.shipTo.address.stateProvince,
          pkg.shipTo.address.countryCode
        ].filter(Boolean).join(', ');
        if (location) console.log(`   ${location}`);
      }
    }
    
    // Travel Log / Activity History
    console.log('\n' + '═'.repeat(70));
    console.log('📍 TRAVEL LOG / ACTIVITY HISTORY');
    console.log('═'.repeat(70) + '\n');
    
    if (pkg.activity && pkg.activity.length > 0) {
      pkg.activity.forEach((activity, index) => {
        // Format location
        const location = [
          activity.location.city,
          activity.location.stateProvince,
          activity.location.country
        ].filter(Boolean).join(', ');
        
        // Format date/time
        const datetime = `${activity.date} ${activity.time}`;
        
        // Display activity
        console.log(`${index + 1}. ${datetime}`);
        console.log(`   📍 Location: ${location || 'Unknown'}`);
        console.log(`   📝 Status:   ${activity.status.description}`);
        
        if (activity.location.postalCode) {
          console.log(`   📮 Postal:   ${activity.location.postalCode}`);
        }
        
        console.log('');
      });
    } else {
      console.log('   No activity history available\n');
    }
    
    console.log('═'.repeat(70));
    console.log('✅ TRACKING COMPLETE');
    console.log('═'.repeat(70) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nPlease check:');
    console.error('   • Your internet connection');
    console.error('   • UPS API credentials are correct');
    console.error('   • Tracking number format is valid\n');
  }
}

// Main
const trackingNumber = process.argv[2];

if (!trackingNumber) {
  console.log('\n❌ Please provide a tracking number\n');
  console.log('Usage:');
  console.log('   node scripts/ups-track.js TRACKING_NUMBER\n');
  console.log('Examples:');
  console.log('   node scripts/ups-track.js 1Z999AA10123456784');
  console.log('   node scripts/ups-track.js 1ZB8678F04167536\n');
  console.log('📝 Valid UPS tracking format:');
  console.log('   • Starts with "1Z"');
  console.log('   • Followed by 16 alphanumeric characters');
  console.log('   • Total: 18 characters\n');
  process.exit(1);
}

trackPackage(trackingNumber);
