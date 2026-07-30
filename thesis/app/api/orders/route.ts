import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';
import { v4 as uuidv4 } from 'uuid';
import { OrderSchema, formatZodErrors } from '@/lib/validation';
import { canManageOrders, normalizeApprovalStatus } from '@/lib/roles';
import { serializeOrderUps } from '@/lib/order-serialize';

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

    let orders: any[];

    if (canManageOrders(authResult.role)) {
      orders = await db.get('order_ups').filter(() => true).value();
    } else {
      const mine = await db.get('order_ups').filter({ unique_id_user: authResult.userId }).value();
      orders = (mine || []).filter(
        (o: any) => normalizeApprovalStatus(o.approval_status) === 'approved'
      );
    }

    const transformedOrders = orders.map((order: any) => serializeOrderUps(order));

    return NextResponse.json(transformedOrders);
  } catch {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
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

    if (authResult.role !== 'customer') {
      return NextResponse.json(
        {
          message:
            'New shipment requests can only be created by customer accounts. Staff should review the queue instead.',
        },
        { status: 403 }
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

    const locFrom = (fromLocation || '').trim() || null;
    const locTo = (toLocation || '').trim() || null;

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
      
      // Shipping: origin/destination are often jsonb in Supabase; from_/to_location stay as text labels
      origin: locFrom ? { country: locFrom } : { country: 'Unknown' },
      destination: locTo ? { country: locTo } : { country: 'Unknown' },
      from_location: locFrom || '',
      to_location: locTo || '',
      
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
      
      // Workflow: awaits staff/admin approval before appearing in customer list
      approval_status: 'pending_review',
      reviewed_by: null,
      reviewed_at: null,
      staff_notes: null,
      
      // Extended data for UPS-specific fields
      extended_data: {}
    };

    await db.get('order_ups').push(order);

    return NextResponse.json(order, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating order:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    const errObj = error as { code?: string; details?: string; hint?: string };
    return NextResponse.json(
      {
        message: 'Server error',
        error: errMsg,
        code: errObj?.code,
        details: errObj?.details,
        hint: errObj?.hint,
      },
      { status: 500 }
    );
  }
}
