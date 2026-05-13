'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { productsAPI, ordersAPI } from '@/lib/api';
import TransportationMap from '@/components/TransportationMap';

interface OrderRoute {
  id: string;
  order_id: string;
  from_location: string;
  to_location: string;
  status: string;
  created_at: string;
}

interface Stats {
  active: number;
  inTransit: number;
  delivered: number;
  totalOrders: number;
  weekChange: number | null;    // % change in active orders vs previous 7 days
  monthChange: number | null;   // % change in delivered MTD vs last month same period
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats>({
    active: 0,
    inTransit: 0,
    delivered: 0,
    totalOrders: 0,
    weekChange: null,
    monthChange: null,
  });
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState<OrderRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchRoutes();
  }, []);

  const fetchStats = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await ordersAPI.getAll();
      const orders: any[] = response.data || [];

      const now = new Date();
      const startOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const startOfThisWeek  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
      const startOfLastWeek  = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Active = everything not yet delivered
      const active = orders.filter(
        (o) => o.deliveryStatus !== 'delivered' && o.deliveryStatus !== 'completed'
      ).length;

      // In Transit
      const inTransit = orders.filter((o) => o.deliveryStatus === 'in_transit').length;

      // Delivered Month-To-Date
      const delivered = orders.filter((o) => {
        if (o.deliveryStatus !== 'delivered') return false;
        const d = new Date(o.updatedAt || o.createdAt);
        return d >= startOfMonth;
      }).length;

      // Delivered last month (same elapsed days, for % change)
      const deliveredLastMonth = orders.filter((o) => {
        if (o.deliveryStatus !== 'delivered') return false;
        const d = new Date(o.updatedAt || o.createdAt);
        return d >= startOfLastMonth && d < startOfMonth;
      }).length;

      // Active orders created this week vs last week (for % change)
      const activeThisWeek = orders.filter((o) => {
        const d = new Date(o.createdAt);
        return d >= startOfThisWeek && o.deliveryStatus !== 'delivered';
      }).length;
      const activeLastWeek = orders.filter((o) => {
        const d = new Date(o.createdAt);
        return d >= startOfLastWeek && d < startOfThisWeek && o.deliveryStatus !== 'delivered';
      }).length;

      const weekChange = activeLastWeek > 0
        ? Math.round(((activeThisWeek - activeLastWeek) / activeLastWeek) * 100)
        : null;
      const monthChange = deliveredLastMonth > 0
        ? Math.round(((delivered - deliveredLastMonth) / deliveredLastMonth) * 100)
        : null;

      setStats({
        active,
        inTransit,
        delivered,
        totalOrders: orders.length,
        weekChange,
        monthChange,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoutes = async () => {
    try {
      console.log('📦 Fetching order routes from API...');
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        // Not logged in — show nothing
        setRoutes([]);
        return;
      }
      const response = await fetch('/api/routes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      
      if (result.success && result.data) {
        console.log(`✅ Loaded ${result.data.length} routes`);
        setRoutes(result.data);
      } else {
        console.error('❌ Failed to fetch routes:', result.error);
      }
    } catch (error) {
      console.error('❌ Error fetching routes:', error);
    } finally {
      setRoutesLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-red-600 to-red-800 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-bold mb-4">
              UPS Shipment Tracking Dashboard
            </h1>
            <p className="text-red-100 text-xl mb-8">
              Real-time UPS shipment tracking and management for international logistics
            </p>
            <div className="flex gap-4">
              <Link
                href="/create-order"
                className="bg-white text-red-600 px-8 py-3 rounded-lg font-semibold hover:bg-red-50 transition shadow-lg"
              >
                Create Shipment
              </Link>
              <Link
                href="/orders"
                className="bg-red-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-red-900 transition border-2 border-white"
              >
                View Shipments
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="container mx-auto px-4 py-8 -mt-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Active Shipments */}
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-red-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Active Shipments</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? <span className="inline-block w-12 h-8 bg-gray-200 animate-pulse rounded" /> : stats.active}
                </p>
                {!loading && stats.weekChange !== null ? (
                  <p className={`text-sm mt-1 ${stats.weekChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {stats.weekChange >= 0 ? '↑' : '↓'} {Math.abs(stats.weekChange)}% from last week
                  </p>
                ) : (
                  <p className="text-gray-400 text-sm mt-1">vs last 7 days</p>
                )}
              </div>
              <div className="text-4xl">📦</div>
            </div>
          </div>

          {/* In Transit */}
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">In Transit</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? <span className="inline-block w-12 h-8 bg-gray-200 animate-pulse rounded" /> : stats.inTransit}
                </p>
                <p className="text-yellow-600 text-sm mt-1">Real-time tracking</p>
              </div>
              <div className="text-4xl">🚚</div>
            </div>
          </div>

          {/* Delivered MTD */}
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Delivered (MTD)</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? <span className="inline-block w-12 h-8 bg-gray-200 animate-pulse rounded" /> : stats.delivered}
                </p>
                {!loading && stats.monthChange !== null ? (
                  <p className={`text-sm mt-1 ${stats.monthChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {stats.monthChange >= 0 ? '↑' : '↓'} {Math.abs(stats.monthChange)}% vs last month
                  </p>
                ) : (
                  <p className="text-gray-400 text-sm mt-1">This month</p>
                )}
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>

          {/* Total Orders */}
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-red-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Orders</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? <span className="inline-block w-12 h-8 bg-gray-200 animate-pulse rounded" /> : stats.totalOrders}
                </p>
                <p className="text-gray-500 text-sm mt-1">All time</p>
              </div>
              <div className="text-4xl">📋</div>
            </div>
          </div>
        </div>
      </section>

      {/* Transportation Map Section */}
      <section className="container mx-auto px-4 py-8">
        {routesLoading ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600 mb-4"></div>
            <p className="text-gray-600">Loading transportation routes...</p>
          </div>
        ) : (
          <TransportationMap
            orderRoutes={routes}
            activeRoutes={[]}
            completedRoutes={[]}
            pendingRoutes={[]}
            showControls={true}
          />
        )}
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
            <h3 className="text-xl font-bold text-gray-900 mb-2">UPS Shipment Tracking</h3>
            <p className="text-gray-600 mb-4">
              Track your UPS shipments in real-time with detailed status updates and delivery information.
            </p>
            <Link
              href="/orders"
              className="text-red-600 hover:text-red-700 font-medium"
            >
              View Shipments →
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
