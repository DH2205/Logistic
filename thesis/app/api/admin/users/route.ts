import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';
import { isAdmin, normalizeRole, normalizeApprovalStatus } from '@/lib/roles';

type OrderRow = { unique_id_user?: string; approval_status?: string };

function emptyOrderStats() {
  return {
    totalOrders: 0,
    approvedOrders: 0,
    pendingOrders: 0,
    rejectedOrders: 0,
  };
}

/**
 * GET /api/admin/users
 * Admin only: full directory (no passwords) + per-user order counts.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateToken(request);

    if ('error' in authResult) {
      return NextResponse.json(
        { message: authResult.error },
        { status: authResult.status }
      );
    }

    if (!isAdmin(authResult.role)) {
      return NextResponse.json(
        { message: 'Administrator access required.' },
        { status: 403 }
      );
    }

    const orderRows =
      ((await db.get('order_ups').filter(() => true).value()) as OrderRow[]) || [];
    const orderStats = new Map<string, ReturnType<typeof emptyOrderStats>>();

    for (const o of orderRows) {
      const uid = o.unique_id_user ? String(o.unique_id_user) : '';
      if (!uid) continue;
      if (!orderStats.has(uid)) orderStats.set(uid, emptyOrderStats());
      const s = orderStats.get(uid)!;
      s.totalOrders += 1;
      const st = normalizeApprovalStatus(o.approval_status);
      if (st === 'approved') s.approvedOrders += 1;
      else if (st === 'pending_review') s.pendingOrders += 1;
      else if (st === 'rejected') s.rejectedOrders += 1;
    }

    const rows = await db.get('users').value();
    const users = (rows || []).map((u: Record<string, unknown>) => {
      const id = String(u.id ?? '');
      const uniqueId = String(u.unique_id_user ?? u.id ?? '');
      const stats = orderStats.get(uniqueId) ?? emptyOrderStats();
      return {
        id,
        email: u.email,
        name: u.name,
        phone: u.phone ?? null,
        address: u.address ?? null,
        role: normalizeRole(String(u.role ?? 'customer')),
        uniqueIdUser: uniqueId,
        createdAt: u.created_at ?? null,
        orders: stats,
      };
    });

    return NextResponse.json({ users });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error listing users:', error);
    return NextResponse.json(
      { message: 'Server error', error: message },
      { status: 500 }
    );
  }
}
