import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';
import {
  findOrderScoped,
  orderLookupFilter,
} from '@/lib/order-access';
import { canManageOrders } from '@/lib/roles';

const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

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
    const { status } = body;

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { message: 'Invalid status' },
        { status: 400 }
      );
    }

    const order = await findOrderScoped(id, authResult);
    if (!order) {
      return NextResponse.json(
        { message: 'Order not found' },
        { status: 404 }
      );
    }

    if (!canManageOrders(authResult.role)) {
      return NextResponse.json(
        { message: 'Only staff can change order status.' },
        { status: 403 }
      );
    }

    await db.get('order_ups').find(orderLookupFilter(id, authResult)).assign({
      status: status,
      updated_at: new Date().toISOString()
    });

    const updatedOrder = await findOrderScoped(id, authResult);
    return NextResponse.json(updatedOrder);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
