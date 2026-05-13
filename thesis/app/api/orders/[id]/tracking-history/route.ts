/**
 * API Route: GET /api/orders/[id]/tracking-history
 * Fetches tracking history for a specific order from the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Verify order exists and user has access
    const { data: order, error: orderError } = await supabase
      .from('order_ups')
      .select('order_id, tracking_number, latest_tracking_update, tracking_last_fetched')
      .eq('order_id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Fetch tracking history
    const { data: history, error: historyError } = await supabase
      .from('tracking_history')
      .select('*')
      .eq('order_id', orderId)
      .order('activity_datetime', { ascending: false });

    if (historyError) {
      console.error('Error fetching tracking history:', historyError);
      return NextResponse.json(
        { error: 'Failed to fetch tracking history' },
        { status: 500 }
      );
    }

    // Format response
    const formattedHistory = (history || []).map((activity: any) => ({
      id: activity.id,
      date: activity.activity_date,
      time: activity.activity_time,
      datetime: activity.activity_datetime,
      location: {
        city: activity.location_city,
        state: activity.location_state,
        country: activity.location_country,
        postalCode: activity.location_postal_code,
        full: activity.location_full,
      },
      status: {
        type: activity.status_type,
        code: activity.status_code,
        description: activity.status_description,
      },
      carrier: activity.carrier,
      createdAt: activity.created_at,
    }));

    return NextResponse.json({
      orderId: order.order_id,
      trackingNumber: order.tracking_number,
      lastUpdate: order.latest_tracking_update,
      lastFetched: order.tracking_last_fetched,
      activities: formattedHistory,
      totalActivities: formattedHistory.length,
    });

  } catch (error) {
    console.error('Error in tracking history API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
