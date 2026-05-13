import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { supabase } from '@/lib/supabase';

/**
 * Public route to look up an order for tracking purposes.
 * Accepts either the internal order_id (e.g. ORD-…) OR a carrier tracking
 * number (e.g. a UPS 1Z… number) — whichever the user has to hand.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderID: string }> }
) {
  try {
    const { orderID } = await params;

    // 1. Try matching by order_id in order_ups table (ORD-… format)
    let order = await db.get('order_ups').find({ order_id: orderID }).value();

    // 2. Fall back to matching by tracking_number in order_ups
    if (!order && supabase) {
      const { data } = await supabase
        .from('order_ups')
        .select('*')
        .eq('tracking_number', orderID)
        .limit(1)
        .maybeSingle();
      order = data ?? null;
    }

    // 3. Fall back to orders table by order_id
    if (!order && supabase) {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('order_id', orderID)
        .limit(1)
        .maybeSingle();
      if (data) {
        order = {
          id:              data.id,
          order_id:        data.order_id,
          sender_name:     data.sender_name,
          sender_phone:    data.sender_phone,
          sender_email:    data.sender_email,
          sender_address:  data.sender_address,
          receiver_name:   data.receiver_name,
          receiver_address:data.receiver_address,
          package_name:    data.package_name,
          length:          data.length,
          width:           data.width,
          height:          data.height,
          weight:          data.weight,
          gross_weight:    data.gross_weight,
          measurements:    data.measurements,
          from_location:   data.from_location,
          to_location:     data.to_location,
          origin:          data.origin,
          destination:     data.destination,
          status:          data.status,
          delivery_status: data.delivery_status,
          tracking_number: data.tracking_number,
          carrier:         data.carrier,
          submission_time: data.created_at,
          created_at:      data.created_at,
          updated_at:      data.updated_at,
        };
      }
    }

    // 4. Fall back to orders table by tracking_number
    if (!order && supabase) {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('tracking_number', orderID)
        .limit(1)
        .maybeSingle();
      if (data) {
        order = {
          id:              data.id,
          order_id:        data.order_id,
          sender_name:     data.sender_name,
          sender_phone:    data.sender_phone,
          sender_email:    data.sender_email,
          sender_address:  data.sender_address,
          receiver_name:   data.receiver_name,
          receiver_address:data.receiver_address,
          package_name:    data.package_name,
          length:          data.length,
          width:           data.width,
          height:          data.height,
          weight:          data.weight,
          gross_weight:    data.gross_weight,
          measurements:    data.measurements,
          from_location:   data.from_location,
          to_location:     data.to_location,
          origin:          data.origin,
          destination:     data.destination,
          status:          data.status,
          delivery_status: data.delivery_status,
          tracking_number: data.tracking_number,
          carrier:         data.carrier,
          submission_time: data.created_at,
          created_at:      data.created_at,
          updated_at:      data.updated_at,
        };
      }
    }

    if (!order) {
      return NextResponse.json(
        { message: 'Order not found' },
        { status: 404 }
      );
    }
    // Return camelCase order data without sensitive user information
    const transformedOrder = {
      id: order.id,
      orderId: order.order_id,
      senderName: order.sender_name,
      senderPhone: order.sender_phone,
      senderEmail: order.sender_email,
      senderAddress: order.sender_address,
      receiverName: order.receiver_name,
      receiverAddress: order.receiver_address,
      packageName: order.package_name || `Package for ${order.receiver_name}`,
      length: order.length,
      width: order.width,
      height: order.height,
      weight: order.weight,
      grossWeight: order.gross_weight,
      measurements: order.measurements || `${order.length}x${order.width}x${order.height} cm`,
      origin: typeof order.origin === 'string'
        ? { country: order.origin }
        : order.origin || { country: order.from_location || 'Unknown' },
      destination: typeof order.destination === 'string'
        ? { country: order.destination }
        : order.destination || { country: order.to_location || 'Unknown' },
      fromLocation: order.from_location,
      toLocation: order.to_location,
      status: order.status,
      deliveryStatus: order.delivery_status,
      trackingNumber: order.tracking_number,
      carrier: order.carrier || 'UPS',
      submissionTime: order.submission_time,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };
    return NextResponse.json(transformedOrder);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
