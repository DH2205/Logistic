/**
 * API Route: POST /api/orders/[id]/sync-tracking
 * Fetches latest tracking data from UPS API and stores it in the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { upsTrackingService } from '@/lib/ups-tracking';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Parse UPS date/time format
function parseUPSDateTime(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  
  try {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }

    const { id: orderId } = await params;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Get order from database
    const { data: order, error: orderError } = await supabase
      .from('order_ups')
      .select('order_id, tracking_number')
      .eq('order_id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (!order.tracking_number) {
      return NextResponse.json(
        { error: 'Order has no tracking number' },
        { status: 400 }
      );
    }

    // Fetch tracking data from UPS (returns TrackingInfo — our standard format)
    const trackingData = await upsTrackingService.trackShipment(order.tracking_number);

    if (!trackingData || !trackingData.activities || trackingData.activities.length === 0) {
      return NextResponse.json(
        { error: 'No tracking data found' },
        { status: 404 }
      );
    }

    // Store activities in tracking_history
    // TrackingInfo.activities[i] fields:
    //   timestamp : "YYYYMMDD HHMMSS"  (raw UPS date + time concatenated)
    //   location  : "City, State, Country"  (already formatted string)
    //   status    : UPS status code string (e.g. "D", "IT")
    //   description: human-readable status text
    let stored = 0;
    let skipped = 0;

    for (const activity of trackingData.activities) {
      const [datePart = '', timePart = ''] = (activity.timestamp ?? '').split(' ');
      const activityDatetime = parseUPSDateTime(datePart, timePart);
      const locationFull = activity.location || 'Unknown';

      // Skip duplicates (same order + same date + same time)
      const { data: existing } = await supabase
        .from('tracking_history')
        .select('id')
        .eq('order_id', orderId)
        .eq('activity_date', datePart)
        .eq('activity_time', timePart)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const { error: insertError } = await supabase
        .from('tracking_history')
        .insert({
          order_id: orderId,
          tracking_number: order.tracking_number,
          activity_date: datePart || null,
          activity_time: timePart || null,
          activity_datetime: activityDatetime,
          location_city: null,
          location_state: null,
          location_country: null,
          location_postal_code: null,
          location_full: locationFull,
          status_type: activity.status,
          status_code: null,
          status_description: activity.description,
          carrier: 'UPS',
          source: 'ups_api',
          raw_data: activity,
        });

      if (insertError) {
        console.error('Error inserting activity:', insertError);
      } else {
        stored++;
      }
    }

    // Derive delivery status from the UPS status code of the latest activity
    const upsStatusToDb: Record<string, string> = {
      D:   'delivered',
      IT:  'in_transit',
      OT:  'in_transit',
      OFD: 'in_transit',
      I:   'in_transit',
      P:   'pending',
    };
    const derivedStatus = upsStatusToDb[trackingData.status] ?? null;

    // UPS returns activities in reverse-chronological order.
    // activities[0]   = most recent scan (current/delivered location)
    // activities[last] = oldest scan     (origin/pickup location)
    const activities = trackingData.activities;
    const latestLocation = activities[0]?.location || null;
    const originLocation = activities[activities.length - 1]?.location || null;

    // Update order_ups: timestamps, delivery status, and the real origin/destination
    // derived from UPS scan data (overrides any stale DB values).
    const orderUpdate: Record<string, unknown> = {
      tracking_last_fetched: new Date().toISOString(),
      latest_tracking_update: new Date().toISOString(),
    };
    if (derivedStatus) {
      orderUpdate.delivery_status = derivedStatus;
      orderUpdate.status = derivedStatus;
    }
    if (originLocation) {
      orderUpdate.from_location = originLocation;
      // Also update the JSONB origin column so all API consumers see the real value
      orderUpdate.origin = { country: originLocation };
    }
    if (latestLocation) {
      orderUpdate.to_location = latestLocation;
      // Also update the JSONB destination column
      orderUpdate.destination = { country: latestLocation };
    }

    const { error: updateError } = await supabase
      .from('order_ups')
      .update(orderUpdate)
      .eq('order_id', orderId);

    if (updateError) {
      console.error('[sync-tracking] DB update failed (RLS or network):', updateError.message);
    }

    return NextResponse.json({
      success: true,
      orderId: orderId,
      trackingNumber: order.tracking_number,
      totalActivities: trackingData.activities.length,
      newActivities: stored,
      skippedActivities: skipped,
      dbUpdateOk: !updateError,
      // Live-derived fields — callers can use these even if the DB write failed
      derivedStatus: derivedStatus,
      originLocation: originLocation,
      latestLocation: latestLocation,
      trackingData: {
        status: trackingData.status,
        statusDescription: trackingData.statusDescription,
        currentLocation: trackingData.currentLocation,
        estimatedDelivery: trackingData.estimatedDelivery,
      },
    });

  } catch (error) {
    console.error('Error syncing tracking:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync tracking data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
