'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TransportationMap from '@/components/maps/TransportationMap';
import { useAuth } from '@/contexts/AuthContext';

interface OrderRoute {
  id: string;
  order_id: string;
  from_location: string;
  to_location: string;
  status: string;
  created_at: string;
}

export default function OperationsMapPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [routes, setRoutes] = useState<OrderRoute[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) {
      router.push('/login');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    (async () => {
      try {
        const res = await fetch('/api/routes', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setRoutes(data.data);
        }
      } catch (e) {
        console.error('[operations-map] routes fetch failed', e);
      }
    })();
  }, [mounted, user, router]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        Redirecting…
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-6 px-4">
      <div className="max-w-[1920px] mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Route &amp; transportation map</h1>
          <p className="text-sm text-gray-600 mt-1">
            The map stays light on first load. Use the checkboxes above each section to show facilities, shipment
            routes, or disruption zones. Tracking a single order still draws that shipment without turning on “Show
            routes on map.” Staff see all routes in the list; customers only their own.
          </p>
        </div>
        <TransportationMap
          orderRoutes={routes}
          activeRoutes={[]}
          completedRoutes={[]}
          pendingRoutes={[]}
          showControls
          stackedDetail
        />
      </div>
    </div>
  );
}
