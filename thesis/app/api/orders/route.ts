import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';
import { v4 as uuidv4 } from 'uuid';

// Generate unique orderID
function generateOrderID() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD-${timestamp}${random}`;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateToken(request);
    
    if ('error' in authResult) {
      return NextResponse.json(
        { message: authResult.error },
        { status: authResult.status }
      );
    }

    // Fetch orders using correct database field name (snake_case)
    const orders = await db.get('orders').filter({ user_id: authResult.userId }).value();
    
    // Transform snake_case to camelCase for frontend
    const transformedOrders = orders.map((order: any) => ({
      id: order.id,
      orderID: order.order_id,  // order_id -> orderID
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
      
      // Shipping information - handle both string and object formats
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
    }));
    
    return NextResponse.json(transformedOrders);
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateToken(request);
    
    if ('error' in authResult) {
      return NextResponse.json(
        { message: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await request.json();
    
    // Support both old and new format
    const {
      orderId,
      // New format fields
      senderName,
      senderPhone,
      senderEmail,
      senderAddress,
      receiverName,
      receiverAddress,
      length,
      width,
      height,
      weight,
      grossWeight,
      fromLocation,
      toLocation,
      // Old format fields (for backwards compatibility)
      packageName,
      measurements,
      customerName,
      sender,
      origin,
      destination
    } = body;

    // Validate required fields (new format)
    if (!senderName || !receiverName || !weight) {
      return NextResponse.json(
        { message: 'Sender name, receiver name, and weight are required' },
        { status: 400 }
      );
    }

    // Use provided orderId or generate a new one
    let finalOrderId = orderId;
    if (!finalOrderId) {
      let isUnique = false;
      while (!isUnique) {
        finalOrderId = generateOrderID();
        const existingOrder = await db.get('orders').find({ orderID: finalOrderId }).value();
        if (!existingOrder) {
          isUnique = true;
        }
      }
    }

    // Get current timestamp
    const submissionTime = new Date().toISOString();

    // Create order with new structure
    const order = {
      id: uuidv4(),
      order_id: finalOrderId,
      user_id: authResult.userId,
      unique_id_user: authResult.userId,  // ✅ Link order to user's unique ID
      
      // Sender information
      sender_name: senderName,
      sender_phone: senderPhone || '',
      sender_email: senderEmail || '',
      sender_address: senderAddress || '',
      
      // Receiver information
      receiver_name: receiverName,
      receiver_address: receiverAddress || '',
      
      // Package information
      length: parseFloat(length) || 0,
      width: parseFloat(width) || 0,
      height: parseFloat(height) || 0,
      weight: parseFloat(weight),
      gross_weight: parseFloat(grossWeight) || parseFloat(weight),
      
      // Shipping information
      origin: fromLocation || '',
      destination: toLocation || '',
      from_location: fromLocation || '',
      to_location: toLocation || '',
      
      // Status fields
      status: 'pending',
      delivery_status: 'pending',
      tracking_number: `TRK${Date.now()}`,
      
      // Timestamps
      submission_time: submissionTime,
      created_at: submissionTime,
      updated_at: submissionTime,
      
      // Legacy fields for backwards compatibility
      package_name: packageName || `Package for ${receiverName}`,
      measurements: measurements || `${length}x${width}x${height} cm`,
      customer_name: customerName || senderName,
    };

    await db.get('orders').push(order);

    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
