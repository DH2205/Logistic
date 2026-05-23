'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ordersAPI } from '@/lib/api';
import { normalizeRole, normalizeApprovalStatus } from '@/lib/roles';

type ApprovalFilter = 'all' | 'pending_review' | 'approved' | 'rejected';

const FILTER_TABS: { key: ApprovalFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending_review', label: 'Pending review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function StaffOrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>('all');

  const role = useMemo(() => normalizeRole(user?.role), [user?.role]);
  const canAccess = role === 'staff' || role === 'admin';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !user) return;
    if (!canAccess) {
      router.push('/orders');
      return;
    }
    (async () => {
      try {
        const res = await ordersAPI.getAll();
        const raw = res.data;
        setOrders(Array.isArray(raw) ? raw : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [mounted, user, canAccess, router]);

  const statusCounts = useMemo(() => {
    const c = { all: orders.length, pending_review: 0, approved: 0, rejected: 0 };
    for (const o of orders) {
      const n = normalizeApprovalStatus(o.approvalStatus);
      if (n === 'pending_review') c.pending_review += 1;
      else if (n === 'rejected') c.rejected += 1;
      else c.approved += 1;
    }
    return c;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (approvalFilter === 'all') return orders;
    return orders.filter((o) => {
      const n = normalizeApprovalStatus(o.approvalStatus);
      if (approvalFilter === 'pending_review') return n === 'pending_review';
      return n === approvalFilter;
    });
  }, [orders, approvalFilter]);

  const refresh = async () => {
    const res = await ordersAPI.getAll();
    const raw = res.data;
    setOrders(Array.isArray(raw) ? raw : []);
  };

  const approve = async (orderID: string) => {
    setActingId(orderID);
    try {
      await ordersAPI.review(orderID, { approvalStatus: 'approved' });
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setActingId(null);
    }
  };

  const reject = async (orderID: string) => {
    const notes = window.prompt('Optional note for the customer (internal record):', '') ?? '';
    setActingId(orderID);
    try {
      await ordersAPI.review(orderID, {
        approvalStatus: 'rejected',
        staffNotes: notes.trim() || undefined,
      });
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setActingId(null);
    }
  };

  if (!mounted || !user) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600" />
      </div>
    );
  }

  if (!canAccess) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Order queue</h1>
          <p className="text-gray-600 mt-1 max-w-xl">
            Review customer requests. Approve to make them visible on the customer&apos;s Orders page.{' '}
            <span className="text-gray-500">
              Queue &quot;Approval&quot; is different from the customer&apos;s &quot;Delivery status&quot; (e.g. pending shipment vs. staff-approved).
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-2 shrink-0 w-full lg:w-auto lg:min-w-[320px]">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Filter by approval
          </span>
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map(({ key, label }) => {
              const count =
                key === 'all'
                  ? statusCounts.all
                  : statusCounts[key];
              const active = approvalFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setApprovalFilter(key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {label}
                  <span
                    className={`tabular-nums rounded-md px-1.5 py-0.5 text-xs font-bold ${
                      active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md border border-gray-100 p-12 text-center text-gray-600">
          No orders in the system.
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md border border-gray-100 p-12 text-center text-gray-600">
          No orders match this filter. Try another approval status.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approval</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.map((o) => {
                const st = (o.approvalStatus || 'pending_review').toLowerCase();
                const pending = st === 'pending_review' || st === 'pending';
                return (
                  <tr key={o.id || o.orderID} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{o.orderID}</div>
                      <div className="text-xs text-gray-500">
                        {o.createdAt ? new Date(o.createdAt).toLocaleString() : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      <div>{o.senderName || o.customerName || '—'}</div>
                      <div className="text-xs text-gray-500">User: {o.uniqueIdUser?.slice(0, 8)}…</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {o.fromLocation || o.origin?.country || '—'} →{' '}
                      {o.toLocation || o.destination?.country || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          st === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : st === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {st === 'pending' ? 'pending_review' : st}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/orders/${o.orderID}`}
                          className="text-red-600 hover:underline font-medium"
                        >
                          Open
                        </Link>
                        {pending && (
                          <>
                            <button
                              type="button"
                              disabled={actingId === o.orderID}
                              onClick={() => approve(o.orderID)}
                              className="text-green-700 hover:underline disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={actingId === o.orderID}
                              onClick={() => reject(o.orderID)}
                              className="text-red-700 hover:underline disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
