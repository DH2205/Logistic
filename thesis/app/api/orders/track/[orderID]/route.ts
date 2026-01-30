import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

// Public route to get order by orderID (for tracking)
export async function GET(
  request: NextRequest,
  { params }: { params: { orderID: string } }
) {
  try {
    const order = await db.get('orders').find({ orderID: params.orderID }).value();
    if (!order) {
      return NextResponse.json(
        { message: 'Order not found' },
        { status: 404 }
      );
    }
    // Return order without sensitive user information
    const { userId, ...orderData } = order;
    return NextResponse.json(orderData);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
