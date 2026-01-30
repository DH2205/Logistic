'use client';

import Link from 'next/link';

export default function ShipmentsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Shipments</h1>
        <Link
          href="/orders/create"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mt-8">
          <Link
            href="/orders"
            className="bg-red-50 p-6 rounded-lg hover:bg-red-100 transition"
          >
            <div className="text-3xl mb-2">📦</div>
            <h3 className="font-semibold text-gray-900">View Orders</h3>
            <p className="text-sm text-gray-600 mt-1">See all your orders</p>
          </Link>
          <Link
            href="/locations"
            className="bg-blue-50 p-6 rounded-lg hover:bg-blue-100 transition"
          >
            <div className="text-3xl mb-2">📍</div>
            <h3 className="font-semibold text-gray-900">Locations</h3>
            <p className="text-sm text-gray-600 mt-1">Manage locations</p>
          </Link>
          <Link
            href="/database"
            className="bg-green-50 p-6 rounded-lg hover:bg-green-100 transition"
          >
            <div className="text-3xl mb-2">💾</div>
            <h3 className="font-semibold text-gray-900">Database</h3>
            <p className="text-sm text-gray-600 mt-1">View raw data</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
