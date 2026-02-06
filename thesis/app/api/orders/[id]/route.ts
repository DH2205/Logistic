import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';

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

    // Await params Promise in Next.js 16 to correctly extract id
    const { id } = await params;

    // Search by order_id (the user-friendly ID like ORD-...) instead of UUID
    const order = await db.get('orders').find({ order_id: id, user_id: authResult.userId }).value();
    if (!order) {
      console.error(`❌ Order not found: order_id="${id}", user_id="${authResult.userId}"`);
      return NextResponse.json(
        { message: 'Order not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Order found: ${order.order_id} for user ${authResult.userId}`);

    // Transform snake_case to camelCase for frontend
    const transformedOrder = {
      id: order.id,
      orderId: order.order_id,  // Changed from orderID to orderId to match frontend
      userId: order.user_id,
      uniqueIdUser: order.unique_id_user,
      
      // Sender information
      senderName: order.sender_name,
      senderPhone: order.sender_phone,
      senderEmail: order.sender_email,
      senderAddress: order.sender_address,
      
      // Receiver information
      receiverName: order.receiver_name,
      receiverAddress: order.receiver_address,
      
      // Package information
      packageName: order.package_name || `Package for ${order.receiver_name}`,
      length: order.length,
      width: order.width,
      height: order.height,
      weight: order.weight,
      grossWeight: order.gross_weight,
      measurements: order.measurements || `${order.length}x${order.width}x${order.height} cm`,
      
      // Shipping information
      origin: typeof order.origin === 'string' 
        ? { country: order.origin }
        : order.origin || { country: order.from_location || 'Unknown' },
      destination: typeof order.destination === 'string'
        ? { country: order.destination }
        : order.destination || { country: order.to_location || 'Unknown' },
      fromLocation: order.from_location,
      toLocation: order.to_location,
      
      // Status fields
      status: order.status,
      deliveryStatus: order.delivery_status,
      trackingNumber: order.tracking_number,
      
      // Timestamps
      submissionTime: order.submission_time,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      
      // Legacy fields
      customerName: order.customer_name,
    };

    return NextResponse.json(transformedOrder);
  } catch (error: any) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
