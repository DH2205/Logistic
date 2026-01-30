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

    const orders = await db.get('orders').filter({ userId: authResult.userId }).value();
    return NextResponse.json(orders);
  } catch (error: any) {
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
    const {
      packageName,
      measurements,
      weight,
      customerName,
      receiverName,
      sender,
      origin,
      destination
    } = body;

    // Basic validation
    if (!packageName || !measurements || !weight || !customerName || !receiverName || !sender || !origin || !destination) {
      return NextResponse.json(
        { message: 'All order fields are required' },
        { status: 400 }
      );
    }

    // Generate unique orderID
    let orderID;
    let isUnique = false;
    while (!isUnique) {
      orderID = generateOrderID();
      const existingOrder = await db.get('orders').find({ orderID }).value();
      if (!existingOrder) {
        isUnique = true;
      }
    }

    // Get current timestamp for submission time
    const submissionTime = new Date().toISOString();

    // Create order
    const order = {
      id: uuidv4(),
      orderID: orderID,
      userId: authResult.userId,
      packageName: packageName,
      measurements: measurements,
      weight: parseFloat(weight),
      customerName: customerName,
      receiverName: receiverName,
      sender: {
        name: sender.name,
        phone: sender.phone,
        email: sender.email,
        address: sender.address,
      },
      origin: {
        country: origin.country,
      },
      destination: {
        country: destination.country,
      },
      submissionTime: submissionTime,
      status: 'pending',
      deliveryStatus: 'processing',
      trackingNumber: `TRK${Date.now()}`,
      createdAt: submissionTime,
      updatedAt: submissionTime
    };

    await db.get('orders').push(order);

    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
