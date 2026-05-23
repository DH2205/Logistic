import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';
import { OrderReviewSchema, formatZodErrors } from '@/lib/validation';
import { canManageOrders } from '@/lib/roles';
import { findOrderScoped, orderLookupFilter } from '@/lib/order-access';
import { serializeOrderUps } from '@/lib/order-serialize';
import { mergeShipmentPatchIntoDbUpdates } from '@/lib/order-shipment-updates';

/**
 * POST /api/orders/:id/review
 * Staff/admin: set approval, notes, optional corrections (addresses, weight, tracking, etc.).
 */
export async function POST(
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

    if (!canManageOrders(authResult.role)) {
      return NextResponse.json(
        { message: 'Only staff or admin can review orders.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const order = await findOrderScoped(id, authResult);
    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = OrderReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid review payload', errors: formatZodErrors(parsed.error.issues) },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.approvalStatus !== undefined) {
      const s = data.approvalStatus === 'pending' ? 'pending_review' : data.approvalStatus;
      updates.approval_status = s;
      updates.reviewed_by = authResult.userId;
      updates.reviewed_at = new Date().toISOString();
    }

    if (data.staffNotes !== undefined) {
      updates.staff_notes = data.staffNotes;
    }

    const { approvalStatus: _a, staffNotes: _s, ...shipmentRest } = data;
    mergeShipmentPatchIntoDbUpdates(shipmentRest, updates);

    const meaningfulKeys = Object.keys(updates).filter((k) => k !== 'updated_at');
    if (meaningfulKeys.length === 0) {
      return NextResponse.json(
        { message: 'No changes supplied. Send approvalStatus, staffNotes, trackingNumber, or shipment fields.' },
        { status: 400 }
      );
    }

    const updateResult = await db
      .get('order_ups')
      .find(orderLookupFilter(id, authResult))
      .assign(updates);

    const updated = updateResult.value();
    if (!updated) {
      return NextResponse.json({ message: 'Failed to update order' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: serializeOrderUps(updated as Record<string, unknown>),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in order review:', error);
    return NextResponse.json(
      { message: 'Server error', error: message },
      { status: 500 }
    );
  }
}
