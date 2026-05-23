export type AppRole = 'admin' | 'staff' | 'customer';

/** Normalize DB / JWT role strings (legacy `user` → customer). */
export function normalizeRole(input: string | null | undefined): AppRole {
  const r = (input ?? '').trim().toLowerCase();
  if (r === 'admin') return 'admin';
  if (r === 'staff') return 'staff';
  return 'customer';
}

export function isAdmin(role: AppRole): boolean {
  return role === 'admin';
}

export function canManageOrders(role: AppRole): boolean {
  return role === 'admin' || role === 'staff';
}

export type ApprovalStatus = 'pending_review' | 'approved' | 'rejected';

export function normalizeApprovalStatus(input: string | null | undefined): ApprovalStatus {
  const s = (input ?? '').trim().toLowerCase();
  if (s === 'pending_review' || s === 'pending') return 'pending_review';
  if (s === 'rejected') return 'rejected';
  return 'approved';
}
