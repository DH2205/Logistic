'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeRole } from '@/lib/roles';

export default function ShipmentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.title = 'LogiShop: Shipments';
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    const r = normalizeRole(user.role);
    if (r !== 'staff' && r !== 'admin') {
      router.replace('/orders');
    }
  }, [mounted, user, router]);

  if (!mounted || !user) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600" />
      </div>
    );
  }

  if (normalizeRole(user.role) !== 'staff' && normalizeRole(user.role) !== 'admin') {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Shipments</h1>
        <Link
          href="/create-order"
          className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition font-semibold"
        >
          Create Shipment
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <div className="text-6xl mb-4">🚚</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Shipments Management</h2>
        <p className="text-gray-600 mb-6">
          Track and manage all your shipments in one place
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mt-8">
          <Link
            href="/orders"
            className="bg-red-50 p-6 rounded-lg hover:bg-red-100 transition"
          >
            <div className="text-3xl mb-2">📦</div>
            <h3 className="font-semibold text-gray-900">View Orders</h3>
            <p className="text-sm text-gray-600 mt-1">See all orders</p>
          </Link>
          <Link
            href="/locations"
            className="bg-blue-50 p-6 rounded-lg hover:bg-blue-100 transition"
          >
            <div className="text-3xl mb-2">📍</div>
            <h3 className="font-semibold text-gray-900">Locations</h3>
            <p className="text-sm text-gray-600 mt-1">Manage locations</p>
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-8">
          For raw table access, open the{' '}
          <Link href="/database" className="text-red-600 hover:underline font-medium">
            database view
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
