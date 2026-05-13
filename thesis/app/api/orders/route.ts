import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';
import { v4 as uuidv4 } from 'uuid';
import { OrderSchema, formatZodErrors } from '@/lib/validation';

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
    const orders = await db.get('order_ups').filter({ unique_id_user: authResult.userId }).value();
    
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
      carrier: order.carrier || 'UPS',
      
      // Timestamps
      submissionTime: order.submission_time,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      
      // Legacy fields
      customerName: order.customer_name,
      sender: order.sender,
      
      // Extended data
      extendedData: order.extended_data || {},
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

    // ── XSS / Injection Prevention: validate & sanitize all inputs ────────
    const parsed = OrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid order data', errors: formatZodErrors(parsed.error.issues) },
        { status: 400 }
      );
    }
    const {
      orderId,
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
      carrier,
      packageName,
      measurements,
      customerName,
      sender,
      origin,
      destination,
    } = parsed.data;
    // ── All fields are now type-checked, range-checked, and sanitized ─────

    // Use provided orderId or generate a new one
    let finalOrderId = orderId;
    if (!finalOrderId) {
      let isUnique = false;
      while (!isUnique) {
        finalOrderId = generateOrderID();
        const existingOrder = await db.get('order_ups').find({ order_id: finalOrderId }).value();
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
      
      // Package information — already numbers from Zod coerce, no parseFloat needed
      length: length ?? 0,
      width:  width  ?? 0,
      height: height ?? 0,
      weight: weight,
      gross_weight: grossWeight ?? weight,
      
      // Shipping information
      origin: fromLocation || '',
      destination: toLocation || '',
      from_location: fromLocation || '',
      to_location: toLocation || '',
      
      // Status fields
      status: 'pending',
      delivery_status: 'pending',
      tracking_number: null,  // Empty - to be filled by customer service
      carrier: carrier || 'UPS',
      
      // Timestamps
      submission_time: submissionTime,
      created_at: submissionTime,
      updated_at: submissionTime,
      
      // Legacy fields for backwards compatibility
      package_name: packageName || `Package for ${receiverName}`,
      measurements: measurements || `${length}x${width}x${height} cm`,
      customer_name: customerName || senderName,
      sender: sender || senderName,
      
      // Extended data for UPS-specific fields
      extended_data: {}
    };

    await db.get('order_ups').push(order);

    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
