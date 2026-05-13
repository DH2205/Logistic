/**
 * Sync UPS Tracking Data to Database
 * Fetches tracking information and stores it in tracking_history table
 * 
 * Usage: node scripts/sync-tracking.js [ORDER_ID]
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse date/time from UPS format (20260216 000700)
function parseUPSDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  
  try {
    // Date: 20260216 -> 2026-02-16
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    
    // Time: 000700 -> 00:07:00
    const hour = timeStr.substring(0, 2);
    const minute = timeStr.substring(2, 4);
    const second = timeStr.substring(4, 6);
    
    const datetime = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
    return new Date(datetime).toISOString();
  } catch (error) {
    console.error('Error parsing datetime:', error);
    return null;
  }
}

// Fetch tracking data from UPS API
async function fetchUPSTracking(trackingNumber) {
  const clientId = process.env.UPS_CLIENT_ID;
  const clientSecret = process.env.UPS_CLIENT_SECRET;
  const baseUrl = process.env.UPS_API_BASE_URL || 'https://onlinetools.ups.com';
  
  try {
    // Authenticate
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
      throw new Error('UPS authentication failed');
    }
    
    const authData = await authResponse.json();
    
    // Get tracking data
    const trackResponse = await fetch(
      `${baseUrl}/api/track/v1/details/${trackingNumber}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authData.access_token}`,
          'Content-Type': 'application/json',
          'transId': `sync-${Date.now()}`,
          'transactionSrc': 'LogiShop',
        },
      }
    );
    
    if (!trackResponse.ok) {
      throw new Error(`Tracking failed: ${trackResponse.status}`);
    }
    
    const trackData = await trackResponse.json();
    return trackData;
  } catch (error) {
    throw new Error(`Failed to fetch tracking: ${error.message}`);
  }
}

// Store tracking activities in database
async function storeTrackingActivities(orderId, trackingNumber, trackData) {
  const shipment = trackData.trackResponse.shipment[0];
  const pkg = shipment.package[0];
  
  if (!pkg.activity || pkg.activity.length === 0) {
    console.log('   No activities found');
    return 0;
  }
  
  let stored = 0;
  let skipped = 0;
  
  for (const activity of pkg.activity) {
    const activityDatetime = parseUPSDateTime(activity.date, activity.time);
    
    const locationFull = [
      activity.location.city,
      activity.location.stateProvince,
      activity.location.country
    ].filter(Boolean).join(', ') || 'Unknown';
    
    const trackingActivity = {
      order_id: orderId,
      tracking_number: trackingNumber,
      activity_date: activity.date,
      activity_time: activity.time,
      activity_datetime: activityDatetime,
      location_city: activity.location.city || null,
      location_state: activity.location.stateProvince || null,
      location_country: activity.location.country || null,
      location_postal_code: activity.location.postalCode || null,
      location_full: locationFull,
      status_type: activity.status.description || activity.status.type,
      status_code: activity.status.code || null,
      status_description: activity.status.description || null,
      carrier: 'UPS',
      source: 'ups_api',
      raw_data: activity,
    };
    
    // Check if this activity already exists
    const { data: existing, error: checkError } = await supabase
      .from('tracking_history')
      .select('id')
      .eq('order_id', orderId)
      .eq('activity_date', activity.date)
      .eq('activity_time', activity.time)
      .single();
    
    if (existing) {
      skipped++;
      continue; // Skip if already exists
    }
    
    // Insert new activity
    const { error: insertError } = await supabase
      .from('tracking_history')
      .insert(trackingActivity);
    
    if (insertError) {
      console.error(`   ❌ Error inserting activity:`, insertError.message);
    } else {
      stored++;
    }
  }
  
  // Update tracking_last_fetched timestamp
  await supabase
    .from('order_ups')
    .update({ tracking_last_fetched: new Date().toISOString() })
    .eq('order_id', orderId);
  
  return { stored, skipped, total: pkg.activity.length };
}

// Sync tracking for a specific order
async function syncOrderTracking(orderId) {
  console.log(`\n📦 Syncing tracking for order: ${orderId}`);
  console.log('─'.repeat(70) + '\n');
  
  try {
    // Get order from database
    const { data: order, error: orderError } = await supabase
      .from('order_ups')
      .select('order_id, tracking_number, receiver_name')
      .eq('order_id', orderId)
      .single();
    
    if (orderError || !order) {
      console.error('❌ Order not found');
      return;
    }
    
    if (!order.tracking_number) {
      console.error('❌ Order has no tracking number');
      return;
    }
    
    console.log('✅ Order found');
    console.log(`   Order ID: ${order.order_id}`);
    console.log(`   Tracking: ${order.tracking_number}`);
    console.log(`   Receiver: ${order.receiver_name}\n`);
    
    // Fetch tracking data from UPS
    console.log('📡 Fetching tracking data from UPS...');
    const trackData = await fetchUPSTracking(order.tracking_number);
    console.log('✅ Tracking data received\n');
    
    // Store in database
    console.log('💾 Storing tracking activities...');
    const result = await storeTrackingActivities(
      order.order_id,
      order.tracking_number,
      trackData
    );
    
    console.log(`\n📊 Results:`);
    console.log(`   Total activities: ${result.total}`);
    console.log(`   Stored new: ${result.stored}`);
    console.log(`   Skipped (duplicates): ${result.skipped}`);
    console.log('\n✅ Sync complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

// Sync all orders with tracking numbers
async function syncAllOrders() {
  console.log('\n📦 Syncing all orders with tracking numbers\n');
  console.log('═'.repeat(70) + '\n');
  
  try {
    // Get all orders with tracking numbers
    const { data: orders, error } = await supabase
      .from('order_ups')
      .select('order_id, tracking_number, receiver_name')
      .not('tracking_number', 'is', null)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(error.message);
    }
    
    if (!orders || orders.length === 0) {
      console.log('No orders with tracking numbers found');
      return;
    }
    
    console.log(`Found ${orders.length} orders with tracking numbers\n`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      console.log(`\n[${i + 1}/${orders.length}] Processing: ${order.order_id}`);
      
      try {
        const trackData = await fetchUPSTracking(order.tracking_number);
        const result = await storeTrackingActivities(
          order.order_id,
          order.tracking_number,
          trackData
        );
        
        console.log(`   ✅ Stored ${result.stored} new activities (${result.skipped} duplicates)`);
        successCount++;
      } catch (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        failCount++;
      }
      
      // Rate limiting - wait 1 second between requests
      if (i < orders.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('\n' + '═'.repeat(70));
    console.log('📊 SYNC SUMMARY');
    console.log('═'.repeat(70));
    console.log(`Total orders: ${orders.length}`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log('═'.repeat(70) + '\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Main
const orderId = process.argv[2];

if (orderId === 'all' || orderId === '--all') {
  syncAllOrders();
} else if (orderId) {
  syncOrderTracking(orderId);
} else {
  console.log('\n📦 UPS Tracking Sync Tool\n');
  console.log('Usage:');
  console.log('  node scripts/sync-tracking.js ORDER_ID       # Sync specific order');
  console.log('  node scripts/sync-tracking.js all            # Sync all orders\n');
  console.log('Examples:');
  console.log('  node scripts/sync-tracking.js ORD-ABC123');
  console.log('  node scripts/sync-tracking.js all\n');
}
