'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ordersAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { normalizeRole, normalizeApprovalStatus } from '@/lib/roles';
import { coerceDeliveryStatusForDisplay } from '@/lib/delivery-status';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const role = user ? normalizeRole(user.role) : 'customer';
  const isStaffOrAdmin = role === 'staff' || role === 'admin';

  // Fix hydration mismatch - only render after mount
  useEffect(() => {
    setMounted(true);
    document.title = 'LogiShop: My Orders';
  }, []);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchOrders();
  }, [user]);

  const handleDelete = async (orderID: string) => {
    setDeletingId(orderID);
    try {
      await ordersAPI.delete(orderID);
      setOrders((prev) => prev.filter((o) => o.orderID !== orderID));
    } catch (error) {
      console.error('Failed to delete order:', error);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  const fetchOrders = async () => {
    try {
      console.log('📡 Fetching orders...');
      const response = await ordersAPI.getAll();
      const raw = response.data;
      const list = Array.isArray(raw) ? raw : [];
      console.log('✅ Orders received:', list);
      setOrders(list);
      setLoading(false);
    } catch (error) {
      console.error('❌ Error fetching orders:', error);
      setLoading(false);
    }
  };

  /** Human-readable delivery line + badge colors from canonical enum (avoids Delivered vs delivered mismatches). */
  const deliveryDisplay = (order: Record<string, unknown>) => {
    const canon = coerceDeliveryStatusForDisplay(
      (order.deliveryStatus ?? order.delivery_status ?? order.status) as string | null | undefined,
    );
    const label = canon.replace(/_/g, ' ');
    let badgeClass =
      'bg-gray-100 text-gray-800';
    if (canon === 'delivered' || canon === 'completed') {
      badgeClass = 'bg-green-100 text-green-800';
    } else if (
      canon === 'in_transit' ||
      canon === 'shipped' ||
      canon === 'out_for_delivery'
    ) {
      badgeClass = 'bg-blue-100 text-blue-800';
    } else if (canon === 'cancelled') {
      badgeClass = 'bg-red-100 text-red-800';
    } else if (
      canon === 'pending' ||
      canon === 'processing' ||
      canon === 'packed' ||
      canon === 'confirmed'
    ) {
      badgeClass = 'bg-yellow-100 text-yellow-800';
    }
    return { label, badgeClass };
  };

  const approvalBadge = (raw: string | null | undefined) => {
    const s = String(raw ?? 'pending_review').trim().toLowerCase().replace(/\s+/g, '_');
    if (s === 'approved') return { text: 'Approved', className: 'bg-green-100 text-green-800' };
    if (s === 'rejected') return { text: 'Rejected', className: 'bg-red-100 text-red-800' };
    const pretty = String(raw ?? 'pending_review').replace(/_/g, ' ');
    return { text: pretty, className: 'bg-amber-100 text-amber-900' };
  };

  // Show nothing during SSR to prevent hydration mismatch
  if (!mounted || !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isStaffOrAdmin ? 'All shipments' : 'My Orders'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isStaffOrAdmin
              ? 'Every order in the system. Use the queue to approve new customer requests.'
              : 'Only requests approved by our team appear here. Delivery status is set by our team and does not change automatically from carrier scans.'}
          </p>
        </div>
        {!isStaffOrAdmin && (
        <Link
          href="/create-order"
          className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition font-semibold"
        >
          + Create New Shipment
        </Link>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No orders yet</h2>
          <p className="text-gray-600 mb-6">
            {isStaffOrAdmin
              ? 'No shipment records in the database.'
              : 'Nothing approved yet. After you create a shipment, staff must approve it before it shows here.'}
          </p>
          {!isStaffOrAdmin && (
            <Link
              href="/create-order"
              className="inline-block bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition font-semibold"
            >
              Create Order
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-[72rem] w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Order ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Tracking Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Carrier
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Receiver
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Route
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Delivery status
                </th>
                {isStaffOrAdmin && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Approval
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Weight
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => {
                const { label: dLabel, badgeClass: deliveryBadgeClass } = deliveryDisplay(order);
                const appr = approvalBadge(order.approvalStatus as string | undefined);
                const canDelete =
                  isStaffOrAdmin ||
                  normalizeApprovalStatus(order.approvalStatus as string | undefined) ===
                    'pending_review';
                return (
                <tr key={String(order.id ?? order.orderID)} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap align-top">
                    <div className="text-sm font-bold text-gray-900">{order.orderID}</div>
                    <div className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap align-top">
                    {order.trackingNumber ? (
                      <div className="text-sm font-mono text-gray-700 break-all">{order.trackingNumber}</div>
                    ) : (
                      <div className="text-sm text-gray-400 italic">Awaiting tracking #</div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap align-top">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-bold rounded bg-yellow-100 text-yellow-800">
                      {order.carrier || 'UPS'}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="text-sm text-gray-900 break-words select-text">{order.receiverName || '—'}</div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="text-sm text-gray-900 break-words select-text">
                      {order.fromLocation || order.origin?.country || 'N/A'} → {order.toLocation || order.destination?.country || 'N/A'}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap align-top">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full select-none ${deliveryBadgeClass}`}
                    >
                      {dLabel}
                    </span>
                  </td>
                  {isStaffOrAdmin && (
                    <td className="px-4 py-4 whitespace-nowrap align-top">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full select-none ${appr.className}`}
                      >
                        {appr.text}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 align-top">
                    {order.weight ? `${order.weight} kg` : 'N/A'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/orders/${order.orderID}`}
                        className="text-red-600 hover:text-red-900 font-semibold whitespace-nowrap"
                      >
                        View details
                      </Link>
                      {canDelete && (
                      <button
                        onClick={() => setConfirmId(order.orderID)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete order"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Order</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete order <span className="font-semibold text-gray-900">{confirmId}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmId)}
                disabled={deletingId === confirmId}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition font-medium disabled:opacity-60"
              >
                {deletingId === confirmId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
