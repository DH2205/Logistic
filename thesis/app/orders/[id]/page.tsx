'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';

interface Order {
  id: string;
  orderID: string;
  userId: string;
  uniqueIdUser: string;
  
  // Sender information
  senderName: string;
  senderPhone: string;
  senderEmail: string;
  senderAddress: string;
  
  // Receiver information
  receiverName: string;
  receiverAddress: string;
  
  // Package information
  packageName: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  grossWeight: number;
  measurements: string;
  
  // Shipping information
  origin: { country: string };
  destination: { country: string };
  fromLocation: string;
  toLocation: string;
  
  // Status fields
  status: string;
  deliveryStatus: string;
  trackingNumber: string;
  
  // Timestamps
  submissionTime: string;
  createdAt: string;
  updatedAt: string;
  
  // Legacy fields
  customerName: string;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // ✅ Unwrap params Promise using React.use()
  const unwrappedParams = use(params);
  const orderId = unwrappedParams.id;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  // Fix hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchOrderDetails();
  }, [user, orderId]); // ✅ Use orderId instead of params.id

  const fetchOrderDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please login to view order details');
        setLoading(false);
        return;
      }

      console.log('📡 Fetching order details for ID:', orderId); // ✅ Use orderId
      const response = await axios.get(`/api/orders/${orderId}`, { // ✅ Use orderId
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('✅ Order details received:', response.data);
      setOrder(response.data);
      setLoading(false);
    } catch (err: any) {
      console.error('❌ Error fetching order:', err);
      setError(err.response?.data?.message || 'Failed to load order details');
      setLoading(false);
    }
  };

  // Show nothing during SSR to prevent hydration mismatch
  if (!mounted || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mb-4"></div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The order you are looking for does not exist.'}</p>
          <Link
            href="/orders"
            className="inline-block bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition font-semibold"
          >
            ← Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'in_transit':
      case 'in transit':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/orders"
            className="inline-flex items-center text-red-600 hover:text-red-700 font-medium mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Orders
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Order Details</h1>
              <p className="text-gray-600 mt-1">Order ID: {order.orderID}</p>
            </div>
            <div className="text-right">
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(order.deliveryStatus)}`}>
                {order.deliveryStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tracking Information */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Tracking Information
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Tracking Number</p>
                  <p className="text-lg font-mono font-semibold text-gray-900">{order.trackingNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="text-lg font-semibold text-gray-900 capitalize">{order.status}</p>
                </div>
              </div>
            </div>

            {/* Shipping Route */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Shipping Route
              </h2>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <div className="bg-green-100 rounded-full p-3">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-gray-600">Origin</p>
                      <p className="text-lg font-semibold text-gray-900">{order.origin.country}</p>
                      {order.fromLocation && order.fromLocation !== order.origin.country && (
                        <p className="text-sm text-gray-600">{order.fromLocation}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex-shrink-0 mx-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center">
                    <div className="bg-blue-100 rounded-full p-3">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-gray-600">Destination</p>
                      <p className="text-lg font-semibold text-gray-900">{order.destination.country}</p>
                      {order.toLocation && order.toLocation !== order.destination.country && (
                        <p className="text-sm text-gray-600">{order.toLocation}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sender & Receiver Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sender */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-6 h-6 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Sender
                </h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-semibold text-gray-900">{order.senderName}</p>
                  </div>
                  {order.senderPhone && (
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-semibold text-gray-900">{order.senderPhone}</p>
                    </div>
                  )}
                  {order.senderEmail && (
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-semibold text-gray-900">{order.senderEmail}</p>
                    </div>
                  )}
                  {order.senderAddress && (
                    <div>
                      <p className="text-sm text-gray-600">Address</p>
                      <p className="font-semibold text-gray-900">{order.senderAddress}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Receiver */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-6 h-6 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Receiver
                </h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-semibold text-gray-900">{order.receiverName}</p>
                  </div>
                  {order.receiverAddress && (
                    <div>
                      <p className="text-sm text-gray-600">Address</p>
                      <p className="font-semibold text-gray-900">{order.receiverAddress}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Package Information */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Package Information
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Length</p>
                  <p className="text-lg font-semibold text-gray-900">{order.length} cm</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Width</p>
                  <p className="text-lg font-semibold text-gray-900">{order.width} cm</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Height</p>
                  <p className="text-lg font-semibold text-gray-900">{order.height} cm</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Weight</p>
                  <p className="text-lg font-semibold text-gray-900">{order.weight} kg</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Gross Weight</p>
                    <p className="text-lg font-semibold text-gray-900">{order.grossWeight} kg</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Measurements</p>
                    <p className="text-lg font-semibold text-gray-900">{order.measurements}</p>
                  </div>
                </div>
              </div>
              {order.packageName && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">Package Name</p>
                  <p className="text-lg font-semibold text-gray-900">{order.packageName}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Timeline & Actions */}
          <div className="space-y-6">
            {/* Order Timeline */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Timeline
              </h2>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-3 h-3 bg-green-500 rounded-full mt-1"></div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Order Created</p>
                    <p className="text-sm text-gray-600">{new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                {order.submissionTime && order.submissionTime !== order.createdAt && (
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mt-1"></div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">Submitted</p>
                      <p className="text-sm text-gray-600">{new Date(order.submissionTime).toLocaleString()}</p>
                    </div>
                  </div>
                )}
                {order.updatedAt && order.updatedAt !== order.createdAt && (
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full mt-1"></div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">Last Updated</p>
                      <p className="text-sm text-gray-600">{new Date(order.updatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <button
                  onClick={() => navigator.clipboard.writeText(order.trackingNumber)}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium text-gray-700"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Tracking Number
                </button>
                <button
                  onClick={() => window.print()}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium text-gray-700"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Order
                </button>
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-lg shadow-md p-6 text-white">
              <h2 className="text-xl font-bold mb-4">Order Summary</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="opacity-90">Order ID:</span>
                  <span className="font-semibold">{order.orderID}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-90">Status:</span>
                  <span className="font-semibold capitalize">{order.deliveryStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-90">Route:</span>
                  <span className="font-semibold text-sm">{order.origin.country} → {order.destination.country}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/20">
                  <span className="opacity-90">Total Weight:</span>
                  <span className="font-bold text-lg">{order.grossWeight} kg</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
