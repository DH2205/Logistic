import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';

/**
 * Generate a random alphanumeric string (uppercase letters and numbers)
 * @param length - Length of the random string (default: 27)
 * @returns Random string like "A1B2C3D4E5F6..."
 */
function generateRandomString(length: number = 27): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate unique order ID in format: ORD-XXXXXXXXXXX
 * Where X is random uppercase letters and numbers (max 32 chars total)
 */
export async function GET(request: NextRequest) {
  try {
    // ✅ Authenticate user
    const authResult = await authenticateToken(request);
    
    if ('error' in authResult) {
      return NextResponse.json(
        { message: authResult.error },
        { status: authResult.status }
      );
    }

    // Get all existing orders to check for duplicates
    const allOrders = await db.get('orders').value();
    const existingOrderIds = new Set(
      allOrders.map((order: any) => order.order_id || order.orderId)
    );

    // Generate unique order ID (retry if duplicate - very unlikely!)
    let orderId: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      // Format: ORD-XXXXXXXXXXX (4 + 1 + 27 = 32 chars max)
      const randomPart = generateRandomString(27);
      orderId = `ORD-${randomPart}`;
      attempts++;

      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique order ID after multiple attempts');
      }
    } while (existingOrderIds.has(orderId));

    console.log(`✅ Generated unique order ID: ${orderId} (user: ${authResult.userId})`);
    
    return NextResponse.json({ orderId });
  } catch (error: any) {
    console.error('❌ Error generating order ID:', error);
    return NextResponse.json(
      { message: 'Error generating order ID', error: error.message },
      { status: 500 }
    );
  }
}
