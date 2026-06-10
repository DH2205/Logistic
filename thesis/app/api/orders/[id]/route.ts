import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';
import { serializeOrderUps } from '@/lib/order-serialize';
import {
  OrderStaffPatchSchema,
  formatZodErrors,
} from '@/lib/validation';
import { mergeShipmentPatchIntoDbUpdates } from '@/lib/order-shipment-updates';
import {
  findOrderScoped,
  canCustomerViewOrder,
  orderLookupFilter,
} from '@/lib/order-access';
import { canManageOrders, normalizeApprovalStatus } from '@/lib/roles';

/**
 * PATCH /api/orders/:id
 * Staff/admin: update any shipment fields (sender, receiver, package dims, route labels, tracking, carrier, …).
 */
export async function PATCH(
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

    const { id } = await params;
    const order = await findOrderScoped(id, authResult);
    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    if (!canManageOrders(authResult.role)) {
      return NextResponse.json(
        { message: 'Only staff or admin can edit orders.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    /** Accept snake_case keys from older clients */
    const normalized = {
      ...body,
      fromLocation: body.fromLocation ?? body.from_location,
      toLocation: body.toLocation ?? body.to_location,
      senderName: body.senderName ?? body.sender_name,
      senderPhone: body.senderPhone ?? body.sender_phone,
      senderEmail: body.senderEmail ?? body.sender_email,
      senderAddress: body.senderAddress ?? body.sender_address,
      receiverName: body.receiverName ?? body.receiver_name,
      receiverAddress: body.receiverAddress ?? body.receiver_address,
      packageName: body.packageName ?? body.package_name,
      grossWeight: body.grossWeight ?? body.gross_weight,
      trackingNumber: body.trackingNumber ?? body.tracking_number,
      customerName: body.customerName ?? body.customer_name,
    };

    const parsed = OrderStaffPatchSchema.safeParse(normalized);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid update', errors: formatZodErrors(parsed.error.issues) },
        { status: 400 }
      );
    }

    const updatedAt = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: updatedAt };
    mergeShipmentPatchIntoDbUpdates(parsed.data, updates);

    const meaningfulKeys = Object.keys(updates).filter((k) => k !== 'updated_at');
    if (meaningfulKeys.length === 0) {
      return NextResponse.json(
        { message: 'No changes supplied.' },
        { status: 400 }
      );
    }

    const updateResult = await db
      .get('order_ups')
      .find(orderLookupFilter(id, authResult))
      .assign(updates);

    const updated = updateResult.value();
    if (!updated) {
      return NextResponse.json(
        { message: 'Failed to update order' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Order updated.',
      order: serializeOrderUps(updated as Record<string, unknown>),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error patching order:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const { id } = await params;

    const order = await findOrderScoped(id, authResult);
    if (!order) {
      return NextResponse.json(
        { message: 'Order not found' },
        { status: 404 }
      );
    }

    if (!canManageOrders(authResult.role)) {
      if (normalizeApprovalStatus((order as { approval_status?: string }).approval_status) !== 'pending_review') {
        return NextResponse.json(
          { message: 'Only pending orders can be deleted by the customer.' },
          { status: 403 }
        );
      }
    }

    await db.get('order_ups').find(orderLookupFilter(id, authResult)).remove();

    return NextResponse.json({ message: 'Order deleted successfully' });
  } catch {
    console.error('Error deleting order:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    const order = await findOrderScoped(id, authResult);
    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    if (!canCustomerViewOrder(order, authResult.role)) {
      return NextResponse.json(
        {
          message:
            'This order is not visible until staff approves it.',
        },
        { status: 403 }
      );
    }

    return NextResponse.json(serializeOrderUps(order as Record<string, unknown>));
  } catch {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
