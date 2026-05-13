import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';

const validDeliveryStatuses = ['processing', 'packed', 'shipped', 'in-transit', 'out-for-delivery', 'delivered'];

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

    // Await params Promise in Next.js 16
    const { id } = await params;

    const body = await request.json();
    const { deliveryStatus } = body;

    if (!deliveryStatus || !validDeliveryStatuses.includes(deliveryStatus)) {
      return NextResponse.json(
        { message: 'Invalid delivery status' },
        { status: 400 }
      );
    }

    const order = await db.get('order_ups').find({ order_id: id, unique_id_user: authResult.userId }).value();
    if (!order) {
      return NextResponse.json(
        { message: 'Order not found' },
        { status: 404 }
      );
    }

    await db.get('order_ups').find({ order_id: id, unique_id_user: authResult.userId }).assign({
      delivery_status: deliveryStatus,
      updated_at: new Date().toISOString()
    });

    const updatedOrder = await db.get('order_ups').find({ order_id: id, unique_id_user: authResult.userId }).value();
    return NextResponse.json(updatedOrder);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
