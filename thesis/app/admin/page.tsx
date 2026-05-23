'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { adminAPI } from '@/lib/api';
import { normalizeRole } from '@/lib/roles';

type OrderStats = {
  totalOrders: number;
  approvedOrders: number;
  pendingOrders: number;
  rejectedOrders: number;
};

type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  address: string | null;
  role: string;
  uniqueIdUser: string;
  createdAt: string | null;
  orders: OrderStats;
};

type FilterTab = 'all' | 'staff' | 'customers';

export default function AdminStaffControlPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>('all');
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editRole, setEditRole] = useState<'customer' | 'staff' | 'admin'>('customer');
  const [editPassword, setEditPassword] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEditUser = (u: AdminUserRow) => {
    setEditUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPhone(u.phone || '');
    setEditAddress(u.address || '');
    setEditRole(
      u.role === 'admin' ? 'admin' : u.role === 'staff' ? 'staff' : 'customer'
    );
    setEditPassword('');
    setEditError(null);
  };

  const closeEditUser = () => {
    setEditUser(null);
    setEditError(null);
    setEditPassword('');
  };

  const saveEditedUser = async () => {
    if (!editUser) return;
    if (!editName.trim() || !editEmail.trim()) {
      setEditError('Name and email are required.');
      return;
    }
    const pw = editPassword.trim();
    if (pw.length > 0 && pw.length < 8) {
      setEditError('Password must be at least 8 characters or left blank.');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const payload: Record<string, unknown> = {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        role: editRole,
        phone: editPhone.trim() === '' ? null : editPhone.trim(),
        address: editAddress.trim() === '' ? null : editAddress.trim(),
      };
      if (pw.length > 0) payload.password = pw;
      const res = await adminAPI.updateUser(editUser.id, payload);
      const u = res.data?.user;
      if (u) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === editUser.id
              ? {
                  ...r,
                  name: String(u.name ?? r.name),
                  email: String(u.email ?? r.email),
                  phone: (u.phone as string | null) ?? null,
                  address: (u.address as string | null) ?? null,
                  role: String(u.role ?? r.role),
                  uniqueIdUser: String(u.uniqueIdUser ?? r.uniqueIdUser),
                }
              : r
          )
        );
      }
      closeEditUser();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
          : 'Update failed';
      setEditError(msg || 'Update failed');
    } finally {
      setEditSaving(false);
    }
  };

  const role = useMemo(() => normalizeRole(user?.role), [user?.role]);
  const isAdmin = role === 'admin';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !user) return;
    if (!isAdmin) {
      router.push('/orders');
      return;
    }
    (async () => {
      try {
        const res = await adminAPI.getUsers();
        setRows(res.data?.users || []);
      } catch (e: unknown) {
        const msg =
          e && typeof e === 'object' && 'response' in e
            ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
            : 'Failed to load directory';
        setError(msg || 'Failed to load directory');
      } finally {
        setLoading(false);
      }
    })();
  }, [mounted, user, isAdmin, router]);

  const filtered = useMemo(() => {
    if (tab === 'staff') {
      return rows.filter((r) => r.role === 'admin' || r.role === 'staff');
    }
    if (tab === 'customers') {
      return rows.filter((r) => r.role === 'customer');
    }
    return rows;
  }, [rows, tab]);

  const staffCount = useMemo(
    () => rows.filter((r) => r.role === 'admin' || r.role === 'staff').length,
    [rows]
  );
  const customerCount = useMemo(() => rows.filter((r) => r.role === 'customer').length, [rows]);

  if (!mounted || !user) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1400px]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Staff</h1>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(
          [
            ['all', `All accounts (${rows.length})`],
            ['staff', `Staff & admins (${staffCount})`],
            ['customers', `Customers (${customerCount})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === key
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600" />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-x-auto border border-gray-200">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-3 text-left font-medium">Role</th>
                <th className="px-3 py-3 text-left font-medium">Name</th>
                <th className="px-3 py-3 text-left font-medium">Login / email</th>
                <th className="px-3 py-3 text-left font-medium">User id</th>
                <th className="px-3 py-3 text-left font-medium">Phone</th>
                <th className="px-3 py-3 text-left font-medium">Address</th>
                <th className="px-3 py-3 text-left font-medium">Shipments</th>
                <th className="px-3 py-3 text-left font-medium">Created</th>
                <th className="px-3 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-800">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/80">
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-900'
                          : u.role === 'staff'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-3 py-3 font-mono text-xs">{u.email}</td>
                  <td className="px-3 py-3 font-mono text-[11px] text-gray-600 break-all max-w-[200px]">
                    {u.uniqueIdUser}
                  </td>
                  <td className="px-3 py-3 max-w-[140px]">{u.phone || '—'}</td>
                  <td className="px-3 py-3 max-w-[200px] text-gray-600">{u.address || '—'}</td>
                  <td className="px-3 py-3 text-xs">
                    <div className="whitespace-nowrap">
                      total <strong>{u.orders.totalOrders}</strong>
                    </div>
                    <div className="text-green-700">appr. {u.orders.approvedOrders}</div>
                    <div className="text-amber-800">pend. {u.orders.pendingOrders}</div>
                    {u.orders.rejectedOrders > 0 && (
                      <div className="text-red-700">rej. {u.orders.rejectedOrders}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-600">
                    {u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEditUser(u)}
                      className="text-sm font-semibold text-red-700 hover:text-red-900"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && !error && (
            <p className="p-8 text-center text-gray-600">No accounts in this filter.</p>
          )}
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Edit user</h3>
            <p className="text-xs text-gray-500 mb-4 font-mono break-all">{editUser.id}</p>
            {editError && (
              <div className="mb-4 rounded-lg bg-red-50 text-red-800 px-3 py-2 text-sm">{editError}</div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email (login)</label>
                <input
                  type="email"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone (leave blank to clear)</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[72px]"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium"
                  value={editRole}
                  onChange={(e) =>
                    setEditRole(e.target.value as 'customer' | 'staff' | 'admin')
                  }
                >
                  <option value="customer">customer</option>
                  <option value="staff">staff</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  New password (optional, min 8 characters)
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={closeEditUser}
                disabled={editSaving}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditedUser}
                disabled={editSaving}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-medium disabled:opacity-60"
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
