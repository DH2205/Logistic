'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { productsAPI, ordersAPI } from '@/lib/api';

export default function HomePage() {
  const [stats, setStats] = useState({
    active: 0,
    inTransit: 0,
    delivered: 0,
    totalValue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch some dummy stats
      setStats({
        active: Math.floor(Math.random() * 50) + 20,
        inTransit: Math.floor(Math.random() * 30) + 15,
        delivered: Math.floor(Math.random() * 200) + 150,
        totalValue: Math.floor(Math.random() * 500000) + 250000,
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-red-600 to-red-800 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-bold mb-4">
              Logistics Optimization Dashboard
            </h1>
            <p className="text-red-100 text-xl mb-8">
              Real-time shipment tracking and route optimization for international logistics
            </p>
            <div className="flex gap-4">
              <Link
                href="/orders/create"
                className="bg-white text-red-600 px-8 py-3 rounded-lg font-semibold hover:bg-red-50 transition shadow-lg"
              >
                Create Order
              </Link>
              <Link
                href="/orders"
                className="bg-red-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-red-900 transition border-2 border-white"
              >
                View Orders
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="container mx-auto px-4 py-8 -mt-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-red-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Active Orders</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.active}</p>
                <p className="text-green-600 text-sm mt-1">↑ 12% from last week</p>
              </div>
              <div className="text-4xl">📦</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">In Transit</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.inTransit}</p>
                <p className="text-red-600 text-sm mt-1">Real-time tracking</p>
              </div>
              <div className="text-4xl">🚚</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Delivered (MTD)</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.delivered}</p>
                <p className="text-green-600 text-sm mt-1">↑ 8% from last month</p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-red-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Value</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  ${(stats.totalValue / 1000).toFixed(0)}K
                </p>
                <p className="text-gray-600 text-sm mt-1">This month</p>
              </div>
              <div className="text-4xl">💰</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Platform Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-xl transition">
            <div className="text-4xl mb-4">🗺️</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Location Management</h3>
            <p className="text-gray-600 mb-4">
              Manage storage facilities, airports, and seaports. Track locations on an interactive map.
            </p>
            <Link
              href="/locations"
              className="text-red-600 hover:text-red-700 font-medium"
            >
              Manage Locations →
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-xl transition">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Order Tracking</h3>
            <p className="text-gray-600 mb-4">
              Track your orders in real-time with detailed status updates and delivery information.
            </p>
            <Link
              href="/orders"
              className="text-red-600 hover:text-red-700 font-medium"
            >
              View Orders →
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-xl transition">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Route Optimization</h3>
            <p className="text-gray-600 mb-4">
              Optimize shipping routes for cost efficiency and delivery speed.
            </p>
            <Link
              href="/shipments"
              className="text-red-600 hover:text-red-700 font-medium"
            >
              View Shipments →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-lg shadow-xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to optimize your logistics?</h2>
          <p className="text-red-100 text-lg mb-8">
            Start managing your shipments more efficiently today.
          </p>
          <Link
            href="/register"
            className="inline-block bg-white text-red-600 px-8 py-3 rounded-lg font-semibold hover:bg-red-50 transition shadow-lg"
          >
            Get Started
          </Link>
        </div>
      </section>
    </div>
  );
}
