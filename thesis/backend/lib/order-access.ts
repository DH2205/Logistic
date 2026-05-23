import { NextRequest } from 'next/server';
import { db } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import type { AppRole } from '@/lib/roles';
import { canManageOrders, normalizeApprovalStatus } from '@/lib/roles';
import { authenticateToken } from '@/lib/middleware';

export type AuthUser = { userId: string; role: AppRole };
export function orderLookupFilter(orderId: string, auth: AuthUser): Record<string, string> {
  if (canManageOrders(auth.role)) return { order_id: orderId };
  return { order_id: orderId, unique_id_user: auth.userId };
}

/** Load order by order_id; staff/admin see any row, customer scoped to own user id. */
export async function findOrderScoped(orderId: string, auth: AuthUser) {
  if (canManageOrders(auth.role)) {
    return db.get('order_ups').find({ order_id: orderId }).value();
  }
  return db
    .get('order_ups')
    .find({ order_id: orderId, unique_id_user: auth.userId })
    .value();
}

/** Customer may read single order only when approved; staff/admin always. */
export function canCustomerViewOrder(order: { approval_status?: string } | null, role: AppRole): boolean {
  if (!order) return false;
  if (canManageOrders(role)) return true;
  return normalizeApprovalStatus(order.approval_status) === 'approved';
}

/**
 * Authenticated tracking/refresh: staff/admin may access any order; customers only
 * their own rows, and only when staff visibility rules allow (e.g. approved).
 */
export async function authorizeOrderTrackingAccess(
  request: NextRequest,
  orderId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authResult = await authenticateToken(request);
  if ('error' in authResult) {
    return { ok: false, status: authResult.status, error: authResult.error };
  }

  let scoped = await findOrderScoped(orderId, authResult);

  if (!scoped && supabase) {
    const { data } = await supabase
      .from('order_ups')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    if (data) {
      if (canManageOrders(authResult.role)) scoped = data as Record<string, unknown>;
      else if (data.unique_id_user === authResult.userId) scoped = data as Record<string, unknown>;
    }
  }

  if (!scoped) {
    return { ok: false, status: 404, error: 'Order not found' };
  }
  if (!canCustomerViewOrder(scoped as { approval_status?: string }, authResult.role)) {
    return {
      ok: false,
      status: 403,
      error: 'This order is not visible until staff approves it.',
    };
  }
  return { ok: true };
}
