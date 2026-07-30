import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';
import { upsTrackingService } from '@/lib/ups-tracking';
import {
  findOrderScoped,
  canCustomerViewOrder,
  orderLookupFilter,
} from '@/lib/order-access';
import { canManageOrders } from '@/lib/roles';

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
    const order = await findOrderScoped(id, authResult);
    if (!order) {
      return NextResponse.json(
        { message: 'Order not found' },
        { status: 404 }
      );
    }

    if (!canManageOrders(authResult.role)) {
      return NextResponse.json(
        { message: 'Only staff can set or change the tracking number. Use Update Tracking to refresh carrier data.' },
        { status: 403 }
      );
    }

    if (!canCustomerViewOrder(order, authResult.role)) {
      return NextResponse.json(
        { message: 'This order is not visible until staff approves it.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { trackingNumber, carrier = 'UPS' } = body;

    if (!trackingNumber) {
      return NextResponse.json(
        { message: 'Tracking number is required' },
        { status: 400 }
      );
    }

    // Update order with tracking number
    const updateResult = await db
      .get('order_ups')
      .find(orderLookupFilter(id, authResult))
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

  } catch {
    console.error('Error updating tracking number:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
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

    const order = await findOrderScoped(id, authResult);
    if (!order) {
      return NextResponse.json(
        { message: 'Order not found' },
        { status: 404 }
      );
    }

    if (!canCustomerViewOrder(order, authResult.role)) {
      return NextResponse.json(
        { message: 'This order is not visible until staff approves it.' },
        { status: 403 }
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
      } catch {
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

  } catch {
    console.error('Error fetching order tracking:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
