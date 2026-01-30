import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';

const validDeliveryStatuses = ['processing', 'packed', 'shipped', 'in-transit', 'out-for-delivery', 'delivered'];

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authenticateToken(request);
    
    if ('error' in authResult) {
      return NextResponse.json(
        { message: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await request.json();
    const { deliveryStatus } = body;

    if (!deliveryStatus || !validDeliveryStatuses.includes(deliveryStatus)) {
      return NextResponse.json(
        { message: 'Invalid delivery status' },
        { status: 400 }
      );
    }

    const order = await db.get('orders').find({ id: params.id }).value();
    if (!order) {
      return NextResponse.json(
        { message: 'Order not found' },
        { status: 404 }
      );
    }

    await db.get('orders').find({ id: params.id }).assign({
      deliveryStatus: deliveryStatus,
      updatedAt: new Date().toISOString()
    });

    const updatedOrder = await db.get('orders').find({ id: params.id }).value();
    return NextResponse.json(updatedOrder);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
