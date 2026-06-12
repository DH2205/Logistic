'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { productsAPI, ordersAPI } from '@/lib/api';
import { coerceDeliveryStatusForDisplay } from '@/lib/delivery-status';
import TransportationMap from '@/components/maps/TransportationMap';

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

      let response;
      try {
        response = await ordersAPI.getAll();
      } catch (err: any) {
        // Unauthenticated or forbidden — silently skip stats
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          setLoading(false);
          return;
        }
        throw err;
      }
      const raw = response.data;
      const orders: Record<string, unknown>[] = Array.isArray(raw) ? raw : [];

      const normDelivery = (o: Record<string, unknown>) =>
        coerceDeliveryStatusForDisplay(
          (o.deliveryStatus ?? o.delivery_status) as string | null | undefined,
        );

      const now = new Date();
      const startOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const startOfThisWeek  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
      const startOfLastWeek  = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const isTerminal = (d: ReturnType<typeof coerceDeliveryStatusForDisplay>) =>
        d === 'delivered' || d === 'completed' || d === 'cancelled';

      const isEnRoute = (d: ReturnType<typeof coerceDeliveryStatusForDisplay>) =>
        d === 'in_transit' || d === 'shipped' || d === 'out_for_delivery';

      const isDeliveredForMtd = (d: ReturnType<typeof coerceDeliveryStatusForDisplay>) =>
        d === 'delivered' || d === 'completed';

      // Active = not finished / not cancelled (matches DB-backed list from /api/orders)
      const active = orders.filter((o) => !isTerminal(normDelivery(o))).length;

      // In transit: on the move (canonical + typical carrier pipeline stages)
      const inTransit = orders.filter((o) => isEnRoute(normDelivery(o))).length;

      // Delivered / completed month-to-date (use updatedAt when set, else createdAt)
      const delivered = orders.filter((o) => {
        if (!isDeliveredForMtd(normDelivery(o))) return false;
        const d = new Date(
          (o.updatedAt ?? o.updated_at ?? o.createdAt ?? o.created_at) as string,
        );
        return !Number.isNaN(d.getTime()) && d >= startOfMonth;
      }).length;

      // Delivered last month (for % change)
      const deliveredLastMonth = orders.filter((o) => {
        if (!isDeliveredForMtd(normDelivery(o))) return false;
        const d = new Date(
          (o.updatedAt ?? o.updated_at ?? o.createdAt ?? o.created_at) as string,
        );
        return !Number.isNaN(d.getTime()) && d >= startOfLastMonth && d < startOfMonth;
      }).length;

      // Active-ish orders created this week vs last week (exclude terminal)
      const activeThisWeek = orders.filter((o) => {
        const d = new Date((o.createdAt ?? o.created_at) as string);
        return !Number.isNaN(d.getTime()) && d >= startOfThisWeek && !isTerminal(normDelivery(o));
      }).length;
      const activeLastWeek = orders.filter((o) => {
        const d = new Date((o.createdAt ?? o.created_at) as string);
        return (
          !Number.isNaN(d.getTime()) &&
          d >= startOfLastWeek &&
          d < startOfThisWeek &&
          !isTerminal(normDelivery(o))
        );
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        // Not logged in — show nothing
        setRoutes([]);
        return;
      }
      const response = await fetch('/api/routes', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Token rejected — clear it and silently skip routes
      if (response.status === 401 || response.status === 403) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
        return;
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setRoutes(result.data);
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
              Delivery Tracking Dashboard
            </h1>
            <p className="text-red-100 text-xl mb-8">
              Real-time delivery tracking and shipment management for international logistics
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
                View Orders
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
            <h3 className="text-xl font-bold text-gray-900 mb-2">Shipment tracking</h3>
            <p className="text-gray-600 mb-4">
              Track carrier shipments in real time with status updates and delivery information.
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
              href="/operations-map"
              className="text-red-600 hover:text-red-700 font-medium"
            >
              View Details →
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
