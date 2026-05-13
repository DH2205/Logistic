import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';
import { upsTrackingService } from '@/lib/ups-tracking';

/**
 * PUT /api/orders/:id/tracking
 * 
 * Update an order's tracking number and sync with UPS
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateToken(request);
    
    if ('error' in authResult) {
      return NextResponse.json(
        { message: authResult.error },
        { status: authResult.status }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { trackingNumber, carrier = 'UPS' } = body;

    if (!trackingNumber) {
      return NextResponse.json(
        { message: 'Tracking number is required' },
        { status: 400 }
      );
    }

    // Find the order
    const order = await db
      .get('order_ups')
      .find({ order_id: id, unique_id_user: authResult.userId })
      .value();

    if (!order) {
      return NextResponse.json(
        { message: 'Order not found' },
        { status: 404 }
      );
    }

    // Update order with tracking number
    const updateResult = await db
      .get('order_ups')
      .find({ order_id: id, unique_id_user: authResult.userId })
      .assign({
        tracking_number: trackingNumber,
        carrier: carrier,
        updated_at: new Date().toISOString(),
      });
    
    // Check if update was successful
    const updatedOrder = updateResult.value();
    if (!updatedOrder) {
      return NextResponse.json(
        { message: 'Failed to update tracking number' },
        { status: 500 }
      );
    }

    // Try to fetch initial tracking data from UPS
    let trackingData = null;
    try {
      if (process.env.UPS_CLIENT_ID && process.env.UPS_CLIENT_SECRET) {
        trackingData = await upsTrackingService.trackShipment(trackingNumber);
      }
    } catch (error) {
      console.warn('Could not fetch initial tracking data:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Tracking number updated successfully',
      order: {
        orderId: order.order_id,
        trackingNumber,
        carrier,
      },
      trackingData,
    });

  } catch (error: any) {
    console.error('Error updating tracking number:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders/:id/tracking
 * 
 * Get tracking information for an order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateToken(request);
    
    if ('error' in authResult) {
      return NextResponse.json(
        { message: authResult.error },
        { status: authResult.status }
      );
    }

    const { id } = await params;

    // Find the order
    const order = await db
      .get('order_ups')
      .find({ order_id: id, unique_id_user: authResult.userId })
      .value();

    if (!order) {
      return NextResponse.json(
        { message: 'Order not found' },
        { status: 404 }
      );
    }

    if (!order.tracking_number) {
      return NextResponse.json(
        { message: 'No tracking number assigned to this order' },
        { status: 404 }
      );
    }

    // Fetch tracking data from UPS
    let trackingData;
    const hasUPSCredentials = 
      process.env.UPS_CLIENT_ID && 
      process.env.UPS_CLIENT_SECRET;

    if (hasUPSCredentials) {
      try {
        trackingData = await upsTrackingService.trackShipment(order.tracking_number);
      } catch (error: any) {
        console.warn('UPS API error:', error);
        const msg: string = error.message || 'UPS API error';
        const isNotFound =
          msg.startsWith('NOT_FOUND:') ||
          msg.toLowerCase().includes('not found') ||
          msg.toLowerCase().includes('invalid') ||
          msg.includes('400') ||
          msg.includes('404');

        const displayMsg = isNotFound
          ? 'Tracking number not found. It may be invalid or not yet active in the UPS system.'
          : `Unable to retrieve tracking information from UPS. Please try again later.`;

        return NextResponse.json(
          { success: false, message: displayMsg, code: isNotFound ? 'NOT_FOUND' : 'UPS_ERROR' },
          { status: isNotFound ? 404 : 502 }
        );
      }
    } else {
      trackingData = upsTrackingService.getMockTrackingData(order.tracking_number);
    }

    return NextResponse.json({
      success: true,
      order: {
        orderId: order.order_id,
        trackingNumber: order.tracking_number,
        carrier: order.carrier || 'UPS',
      },
      trackingData,
      source: hasUPSCredentials ? 'ups' : 'mock',
    });

  } catch (error: any) {
    console.error('Error fetching order tracking:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
