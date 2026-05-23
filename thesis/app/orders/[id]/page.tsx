'use client';

import { use, useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api, { ordersAPI } from '@/lib/api';
import { normalizeRole, normalizeApprovalStatus } from '@/lib/roles';
import { DELIVERY_STATUS_OPTIONS, coerceDeliveryStatusForDisplay } from '@/lib/delivery-status';
import TrackingDisplay, {
  RerouteInsightBanner,
} from '@/components/tracking/TrackingDisplay';
import {
  computeTrackingRerouteInsight,
  parseStoredDisruptions,
  storedDisruptionsToZones,
  type TrackingRerouteInsight,
} from '@/lib/tracking-reroute-insight';

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
  carrier: string;
  
  // Timestamps
  submissionTime: string;
  createdAt: string;
  updatedAt: string;
  
  // Legacy fields
  customerName: string;
  sender: string;
  
  // Extended data
  extendedData: any;
  /** Staff approval workflow (from API when column exists) */
  approvalStatus?: string;
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
  
  // Tracking number editing state
  const [isEditingTracking, setIsEditingTracking] = useState(false);
  const [editedTrackingNumber, setEditedTrackingNumber] = useState('');
  const [editedCarrier, setEditedCarrier] = useState('UPS');
  const [savingTracking, setSavingTracking] = useState(false);
  const [trackingMessage, setTrackingMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // UPS rate quote state
  const [rateData, setRateData] = useState<{
    ok: boolean;
    exchangeRate?: { from: string; to: string; note: string };
    packageSpecs?: {
      actualWeightKg: number;
      dimensionalWeightKg: number;
      billableWeightKg: number;
      dimensions: string;
      origin: string;
      destination: string;
    };
    rates?: Array<{
      serviceCode: string;
      serviceName: string;
      currency: string;
      totalChargeLocal: number;
      totalChargeUSD: number;
      billableWeightKg: number;
    }>;
    cheapest?: { serviceName: string; totalChargeLocal: number; totalChargeUSD: number; currency: string };
    error?: unknown;
    hint?: string;
  } | null>(null);
  const [rateLoading, setRateLoading] = useState(false);

  // Live sync state
  const [syncingTracking, setSyncingTracking] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Origin / destination editing (writes to DB via PATCH /api/orders/:id)
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [editedFromLocation, setEditedFromLocation] = useState('');
  const [editedToLocation, setEditedToLocation] = useState('');
  const [savingRoute, setSavingRoute] = useState(false);
  const [routeMessage, setRouteMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  // Auto-sync indicator (separate from the manual button so the banner is subtle)
  const [autoSyncing, setAutoSyncing] = useState(false);
  const hasAutoSyncedRef = useRef(false);
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [reviewProcessing, setReviewProcessing] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [rerouteInsight, setRerouteInsight] = useState<TrackingRerouteInsight | null>(null);

  /** Staff/admin: full shipment edit + delete */
  const [staffShipmentEdit, setStaffShipmentEdit] = useState(false);
  const [staffShipmentSaving, setStaffShipmentSaving] = useState(false);
  const [staffShipmentMsg, setStaffShipmentMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [staffSenderName, setStaffSenderName] = useState('');
  const [staffSenderPhone, setStaffSenderPhone] = useState('');
  const [staffSenderEmail, setStaffSenderEmail] = useState('');
  const [staffSenderAddress, setStaffSenderAddress] = useState('');
  const [staffReceiverName, setStaffReceiverName] = useState('');
  const [staffReceiverAddress, setStaffReceiverAddress] = useState('');
  const [staffPackageName, setStaffPackageName] = useState('');
  const [staffMeasurements, setStaffMeasurements] = useState('');
  const [staffWeight, setStaffWeight] = useState('');
  const [staffLength, setStaffLength] = useState('');
  const [staffWidth, setStaffWidth] = useState('');
  const [staffHeight, setStaffHeight] = useState('');
  const [staffGrossWeight, setStaffGrossWeight] = useState('');
  const [staffFromLoc, setStaffFromLoc] = useState('');
  const [staffToLoc, setStaffToLoc] = useState('');
  const [staffCarrier, setStaffCarrier] = useState('UPS');
  const [staffTracking, setStaffTracking] = useState('');
  const [staffCustomerName, setStaffCustomerName] = useState('');
  const [staffSenderLegacy, setStaffSenderLegacy] = useState('');
  const [deleteOrderOpen, setDeleteOrderOpen] = useState(false);
  const [deleteOrderBusy, setDeleteOrderBusy] = useState(false);

  // Fix hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  /** Customers may only refresh tracking from the carrier, not edit fields or route. */
  useEffect(() => {
    if (!user) return;
    const r = normalizeRole(user.role);
    if (r !== 'staff' && r !== 'admin') {
      setIsEditingTracking(false);
      setIsEditingRoute(false);
      setStaffShipmentEdit(false);
      setDeleteOrderOpen(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchOrderDetails();
  }, [user, orderId]); // ✅ Use orderId instead of params.id

  /**
   * Auto-sync: once per page visit, as soon as the order (and its tracking
   * number) is available, silently pull the latest carrier data in the
   * background and refresh all displayed fields.
   *
   * This ensures status / origin / destination are always up-to-date without
   * the user having to click "Update Tracking" manually.
   */
  useEffect(() => {
    if (!order?.trackingNumber || hasAutoSyncedRef.current) return;
    hasAutoSyncedRef.current = true; // run exactly once per page visit

    const autoSync = async () => {
      setAutoSyncing(true);
      try {
        await api.post(`/orders/${orderId}/sync-tracking`, {});
        // Re-fetch so all displayed fields (status, route, etc.) reflect DB
        await fetchOrderDetails();
      } catch {
        // Non-critical – silently ignore; the user can always click manually
      } finally {
        setAutoSyncing(false);
      }
    };

    autoSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.trackingNumber]);

  /** Hub reroute + distance saved vs next feasible path (from map disruption zones). */
  useEffect(() => {
    if (!order || typeof window === 'undefined') return;
    let cancelled = false;

    const refreshInsight = async () => {
      const raw = localStorage.getItem('logistics_disruptions');
      const zones = storedDisruptionsToZones(parseStoredDisruptions(raw));
      const from =
        order.fromLocation?.trim() || order.origin?.country?.trim() || '';
      const to =
        order.toLocation?.trim() || order.destination?.country?.trim() || '';
      try {
        const insight = await computeTrackingRerouteInsight(from, to, zones);
        if (!cancelled) setRerouteInsight(insight);
      } catch {
        if (!cancelled) setRerouteInsight(null);
      }
    };

    void refreshInsight();
    const interval = window.setInterval(refreshInsight, 5000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'logistics_disruptions' || e.key === null) void refreshInsight();
    };
    const onDisruptionsChanged = () => void refreshInsight();
    window.addEventListener('storage', onStorage);
    window.addEventListener('logistics-disruptions-changed', onDisruptionsChanged);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refreshInsight();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('logistics-disruptions-changed', onDisruptionsChanged);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [
    order?.fromLocation,
    order?.toLocation,
    order?.origin?.country,
    order?.destination?.country,
  ]);

  // ── Country name → ISO-2 lookup ───────────────────────────────────────────
  const COUNTRY_ISO: Record<string, string> = {
    'vietnam': 'VN', 'viet nam': 'VN',
    'indonesia': 'ID',
    'united states': 'US', 'usa': 'US', 'united states of america': 'US',
    'singapore': 'SG',
    'thailand': 'TH',
    'malaysia': 'MY',
    'japan': 'JP',
    'china': 'CN',
    'germany': 'DE',
    'united kingdom': 'GB', 'uk': 'GB',
    'australia': 'AU',
    'france': 'FR',
    'canada': 'CA',
    'south korea': 'KR', 'korea': 'KR',
    'india': 'IN',
    'philippines': 'PH',
    'hong kong': 'HK',
    'taiwan': 'TW',
    'netherlands': 'NL',
    'italy': 'IT',
    'spain': 'ES',
    'brazil': 'BR',
    'mexico': 'MX',
    'uae': 'AE', 'united arab emirates': 'AE',
    'saudi arabia': 'SA',
  };

  const toISO = (name: string): string => {
    if (!name) return 'VN';
    if (name.length === 2) return name.toUpperCase();
    return COUNTRY_ISO[name.toLowerCase().trim()] ?? name.slice(0, 2).toUpperCase();
  };

  /** Labels for rate API + subtitle — draft while editing, otherwise saved order. */
  const rateRouteLabels = useMemo(() => {
    if (!order) return { origin: '', destination: '' };
    if (isEditingRoute) {
      return {
        origin:
          editedFromLocation.trim() ||
          order.fromLocation ||
          order.origin?.country ||
          '',
        destination:
          editedToLocation.trim() ||
          order.toLocation ||
          order.destination?.country ||
          '',
      };
    }
    return {
      origin: order.fromLocation || order.origin?.country || '',
      destination: order.toLocation || order.destination?.country || '',
    };
  }, [order, isEditingRoute, editedFromLocation, editedToLocation]);

  // UPS rate: staff/admin only (skipped for customer compact view + fewer API calls)
  useEffect(() => {
    if (!order || !user) return;
    const r = normalizeRole(user.role);
    if (r !== 'staff' && r !== 'admin') {
      setRateData(null);
      setRateLoading(false);
      return;
    }
    const originLabel =
      rateRouteLabels.origin ||
      order.fromLocation ||
      order.origin?.country ||
      'VN';
    const destLabel =
      rateRouteLabels.destination ||
      order.toLocation ||
      order.destination?.country ||
      'US';
    const savedFrom = (order.fromLocation || order.origin?.country || '').trim();
    const savedTo = (order.toLocation || order.destination?.country || '').trim();
    const draftDiffers =
      isEditingRoute &&
      (editedFromLocation.trim() !== savedFrom ||
        editedToLocation.trim() !== savedTo);
    const debounceMs = draftDiffers ? 500 : 0;
    const timer = window.setTimeout(async () => {
      setRateLoading(true);
      try {
        const res = await fetch('/api/ups/rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            weightKg: order.weight || 1,
            lengthCm: order.length || 10,
            widthCm: order.width || 10,
            heightCm: order.height || 10,
            originCountryCode: toISO(originLabel),
            destinationCountryCode: toISO(destLabel),
            packageDate: order.createdAt,
          }),
        });
        const data = await res.json();
        setRateData(data);
      } catch {
        setRateData({ ok: false, error: 'Failed to fetch rate' });
      } finally {
        setRateLoading(false);
      }
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [
    order?.id,
    order?.weight,
    order?.length,
    order?.width,
    order?.height,
    order?.createdAt,
    order?.fromLocation,
    order?.toLocation,
    order?.origin?.country,
    order?.destination?.country,
    rateRouteLabels.origin,
    rateRouteLabels.destination,
    isEditingRoute,
    editedFromLocation,
    editedToLocation,
    user?.role,
  ]);

  const fetchOrderDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please login to view order details');
        setLoading(false);
        return;
      }

      console.log('📡 Fetching order details for ID:', orderId); // ✅ Use orderId
      const response = await api.get(`/orders/${orderId}`);

      console.log('✅ Order details received:', response.data);
      setOrder(response.data);
      setEditedTrackingNumber(response.data.trackingNumber || '');
      setEditedCarrier(response.data.carrier || 'UPS');
      setEditedFromLocation(
        response.data.fromLocation ||
          response.data.origin?.country ||
          ''
      );
      setEditedToLocation(
        response.data.toLocation ||
          response.data.destination?.country ||
          ''
      );
      setLoading(false);
    } catch (err: any) {
      console.error('❌ Error fetching order:', err);
      setError(err.response?.data?.message || 'Failed to load order details');
      setLoading(false);
    }
  };

  const handleApproveOrderReview = async () => {
    setReviewProcessing(true);
    setReviewMessage(null);
    try {
      await ordersAPI.review(orderId, { approvalStatus: 'approved' });
      await fetchOrderDetails();
      setReviewMessage({
        type: 'success',
        text: 'Order approved. The customer can see it under Orders.',
      });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setReviewMessage({
        type: 'error',
        text: ax.response?.data?.message || 'Could not approve order.',
      });
    } finally {
      setReviewProcessing(false);
    }
  };

  const handleRejectOrderReview = async () => {
    const notes = window.prompt('Optional note (internal record):');
    if (notes === null) return;
    setReviewProcessing(true);
    setReviewMessage(null);
    try {
      await ordersAPI.review(orderId, {
        approvalStatus: 'rejected',
        staffNotes: notes.trim() || undefined,
      });
      await fetchOrderDetails();
      setReviewMessage({ type: 'success', text: 'Order marked as rejected.' });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setReviewMessage({
        type: 'error',
        text: ax.response?.data?.message || 'Could not reject order.',
      });
    } finally {
      setReviewProcessing(false);
    }
  };

  const handleSaveTrackingNumber = async () => {
    if (!editedTrackingNumber.trim()) {
      setTrackingMessage({ type: 'error', text: 'Please enter a tracking number' });
      return;
    }

    setSavingTracking(true);
    setTrackingMessage(null);

    try {
      const token = localStorage.getItem('token');
      const response = await api.put(
        `/orders/${orderId}/tracking`,
        {
          trackingNumber: editedTrackingNumber.trim(),
          carrier: editedCarrier
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        // Update the order state with new tracking info
        setOrder(prev => prev ? {
          ...prev,
          trackingNumber: editedTrackingNumber.trim(),
          carrier: editedCarrier
        } : null);
        
        setIsEditingTracking(false);
        setTrackingMessage({ type: 'success', text: 'Tracking number saved successfully!' });
        
        // Clear success message after 3 seconds
        setTimeout(() => setTrackingMessage(null), 3000);
      }
    } catch (err: any) {
      console.error('❌ Error saving tracking number:', err);
      setTrackingMessage({ 
        type: 'error', 
        text: err.response?.data?.message || 'Failed to save tracking number' 
      });
    } finally {
      setSavingTracking(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedTrackingNumber(order?.trackingNumber || '');
    setEditedCarrier(order?.carrier || 'UPS');
    setIsEditingTracking(false);
    setTrackingMessage(null);
  };

  const handleSaveRouteLocations = async () => {
    const from = editedFromLocation.trim();
    const to = editedToLocation.trim();
    if (!from || !to) {
      setRouteMessage({ type: 'error', text: 'Enter both origin and destination.' });
      return;
    }
    setSavingRoute(true);
    setRouteMessage(null);
    try {
      const token = localStorage.getItem('token');
      const response = await api.patch(
        `/orders/${orderId}`,
        { fromLocation: from, toLocation: to },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (response.data?.success && response.data.order) {
        setOrder(response.data.order as Order);
        setIsEditingRoute(false);
        setRouteMessage({ type: 'success', text: 'Origin and destination saved to the database.' });
        setTimeout(() => setRouteMessage(null), 4000);
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setRouteMessage({
        type: 'error',
        text: ax.response?.data?.message || 'Failed to save route locations.',
      });
    } finally {
      setSavingRoute(false);
    }
  };

  const handleCancelRouteEdit = () => {
    if (order) {
      setEditedFromLocation(order.fromLocation || order.origin?.country || '');
      setEditedToLocation(order.toLocation || order.destination?.country || '');
    }
    setIsEditingRoute(false);
    setRouteMessage(null);
  };

  const populateStaffShipmentForm = (o: Order) => {
    setStaffSenderName(o.senderName || '');
    setStaffSenderPhone(o.senderPhone || '');
    setStaffSenderEmail(o.senderEmail || '');
    setStaffSenderAddress(o.senderAddress || '');
    setStaffReceiverName(o.receiverName || '');
    setStaffReceiverAddress(o.receiverAddress || '');
    setStaffPackageName(o.packageName || '');
    setStaffMeasurements(o.measurements || '');
    setStaffWeight(o.weight != null ? String(o.weight) : '');
    setStaffLength(o.length != null ? String(o.length) : '');
    setStaffWidth(o.width != null ? String(o.width) : '');
    setStaffHeight(o.height != null ? String(o.height) : '');
    setStaffGrossWeight(o.grossWeight != null ? String(o.grossWeight) : '');
    setStaffFromLoc(o.fromLocation || o.origin?.country || '');
    setStaffToLoc(o.toLocation || o.destination?.country || '');
    setStaffCarrier(o.carrier || 'UPS');
    setStaffTracking(o.trackingNumber || '');
    setStaffCustomerName(o.customerName || '');
    setStaffSenderLegacy(o.sender || '');
  };

  const handleToggleStaffShipmentEdit = () => {
    if (!order) return;
    if (staffShipmentEdit) {
      setStaffShipmentEdit(false);
      setStaffShipmentMsg(null);
    } else {
      populateStaffShipmentForm(order);
      setStaffShipmentEdit(true);
      setStaffShipmentMsg(null);
    }
  };

  const handleSaveStaffShipment = async () => {
    if (!order) return;
    const w = parseFloat(staffWeight);
    if (!staffSenderName.trim() || !staffReceiverName.trim()) {
      setStaffShipmentMsg({ type: 'error', text: 'Sender and receiver names are required.' });
      return;
    }
    if (Number.isNaN(w) || w <= 0) {
      setStaffShipmentMsg({ type: 'error', text: 'Enter a valid weight (kg).' });
      return;
    }
    const parseOptNum = (s: string) => {
      const t = s.trim();
      if (t === '') return undefined;
      const n = parseFloat(t);
      return Number.isNaN(n) ? undefined : n;
    };
    const from = staffFromLoc.trim();
    const to = staffToLoc.trim();
    if (!from || !to) {
      setStaffShipmentMsg({ type: 'error', text: 'Origin and destination are required.' });
      return;
    }
    setStaffShipmentSaving(true);
    setStaffShipmentMsg(null);
    try {
      const res = await ordersAPI.patchOrder(order.orderID, {
        senderName: staffSenderName.trim(),
        senderPhone: staffSenderPhone.trim() || undefined,
        senderEmail: staffSenderEmail.trim() || undefined,
        senderAddress: staffSenderAddress.trim() || undefined,
        receiverName: staffReceiverName.trim(),
        receiverAddress: staffReceiverAddress.trim() || undefined,
        packageName: staffPackageName.trim() || undefined,
        measurements: staffMeasurements.trim() || undefined,
        weight: w,
        length: parseOptNum(staffLength),
        width: parseOptNum(staffWidth),
        height: parseOptNum(staffHeight),
        grossWeight: parseOptNum(staffGrossWeight),
        fromLocation: from,
        toLocation: to,
        carrier: staffCarrier,
        trackingNumber: staffTracking.trim() || '',
        customerName: staffCustomerName.trim() || undefined,
        sender: staffSenderLegacy.trim() || undefined,
      });
      if (res.data?.success && res.data.order) {
        setOrder(res.data.order as Order);
        setStaffShipmentEdit(false);
        setStaffShipmentMsg({ type: 'success', text: 'Shipment updated.' });
        setEditedFromLocation(res.data.order.fromLocation || '');
        setEditedToLocation(res.data.order.toLocation || '');
        setEditedTrackingNumber(res.data.order.trackingNumber || '');
        setEditedCarrier(res.data.order.carrier || 'UPS');
        setTimeout(() => setStaffShipmentMsg(null), 4000);
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setStaffShipmentMsg({
        type: 'error',
        text: ax.response?.data?.message || 'Failed to save shipment.',
      });
    } finally {
      setStaffShipmentSaving(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;
    setDeleteOrderBusy(true);
    try {
      await ordersAPI.delete(order.orderID);
      router.push('/orders');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      alert(ax.response?.data?.message || 'Could not delete order.');
      setDeleteOrderBusy(false);
      setDeleteOrderOpen(false);
    }
  };

  const handleSyncTracking = async () => {
    if (!order?.trackingNumber) {
      setSyncMessage({ type: 'error', text: 'No tracking number assigned to this order.' });
      return;
    }
    setSyncingTracking(true);
    setSyncMessage(null);
    try {
      const response = await api.post(`/orders/${orderId}/sync-tracking`, {});
      const data = response.data;
      const msg = data.newActivities > 0
        ? `Tracking updated — ${data.newActivities} new scan${data.newActivities > 1 ? 's' : ''} recorded.`
        : 'Already up to date — no new scans found.';
      setSyncMessage({ type: 'success', text: msg });
      // Reload order data so status / origin / destination reflect the fresh DB values
      await fetchOrderDetails();
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to pull tracking data from carrier.',
      });
    } finally {
      setSyncingTracking(false);
      setTimeout(() => setSyncMessage(null), 6000);
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
      case 'confirmed':
        return 'bg-slate-100 text-slate-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'packed':
      case 'shipped':
        return 'bg-indigo-100 text-indigo-800';
      case 'in_transit':
      case 'in transit':
      case 'out_for_delivery':
      case 'out for delivery':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  /** Shown everywhere; sourced from DB only (staff-controlled — UPS sync does not overwrite). */
  const effectiveStatus = (order.deliveryStatus || order.status || 'pending').replace(/-/g, '_');

  const isStaffOrAdmin =
    normalizeRole(user.role) === 'staff' || normalizeRole(user.role) === 'admin';
  const compact = !isStaffOrAdmin;
  const cardClass = compact
    ? 'bg-white rounded-lg shadow-sm border border-gray-100 p-4'
    : 'bg-white rounded-lg shadow-md p-6';
  const summaryCardClass = compact
    ? 'bg-gradient-to-br from-red-600 to-red-700 rounded-lg shadow-sm p-4 text-white'
    : 'bg-gradient-to-br from-red-600 to-red-700 rounded-lg shadow-md p-6 text-white';

  const handleStaffDeliveryStatusChange = async (next: string) => {
    setDeliverySaving(true);
    try {
      await ordersAPI.updateDelivery(orderId, next);
      await fetchOrderDetails();
    } catch (err: unknown) {
      console.error(err);
      const ax = err as { response?: { data?: { message?: string } } };
      alert(ax.response?.data?.message || 'Could not update delivery status.');
    } finally {
      setDeliverySaving(false);
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 ${compact ? 'py-4' : 'py-8'}`}>
      <div className={`container mx-auto px-4 ${compact ? 'max-w-4xl' : 'max-w-6xl'}`}>
        {/* Header */}
        <div className={compact ? 'mb-4' : 'mb-6'}>
          <Link
            href="/orders"
            className={`inline-flex items-center text-red-600 hover:text-red-700 font-medium ${compact ? 'mb-2 text-sm' : 'mb-4'}`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Orders
          </Link>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className={`font-bold text-gray-900 ${compact ? 'text-2xl' : 'text-3xl'}`}>
                {compact ? 'Order details' : 'Shipment Details'}
              </h1>
              <p className={`text-gray-600 ${compact ? 'mt-0.5 text-sm' : 'mt-1'}`}>
                Order ID: <span className="font-semibold">{order.orderID}</span>
              </p>
              <p className={`text-gray-500 ${compact ? 'text-xs mt-0.5' : 'text-sm mt-1'}`}>
                Carrier: <span className="font-bold text-yellow-700">{order.carrier || 'UPS'}</span>
              </p>
            </div>
            <div className="text-right flex flex-col items-end gap-1.5">
              <span
                className={`rounded-full font-semibold capitalize ${getStatusColor(effectiveStatus)} ${compact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'}`}
                title={
                  isStaffOrAdmin
                    ? 'Change delivery status in the Tracking section below.'
                    : 'Your team sets this status; carrier updates do not change it automatically.'
                }
              >
                {effectiveStatus.replace(/_/g, ' ')}
              </span>
              {autoSyncing && (
                <span className="flex items-center gap-1.5 text-xs text-gray-500 animate-pulse">
                  <svg className="animate-spin h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Syncing latest tracking…
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 ${compact ? 'gap-4' : 'gap-6'}`}>
          {/* Left Column - Main Details */}
          <div className={`lg:col-span-2 ${compact ? 'space-y-3' : 'space-y-6'}`}>
            {/* UPS Tracking Display */}
            {order.trackingNumber && (
              <TrackingDisplay 
                trackingNumber={order.trackingNumber}
                orderId={order.orderID}
                autoRefresh={true}
                refreshInterval={300}
                rerouteInsight={rerouteInsight}
              />
            )}

            {/* Tracking Information Card - Editable */}
            <div className={cardClass}>
              <div className={`flex items-center justify-between ${compact ? 'mb-2 flex-wrap gap-2' : 'mb-4'}`}>
                <h2 className={`font-bold text-gray-900 flex items-center ${compact ? 'text-base' : 'text-xl'}`}>
                  <svg className={`text-red-600 ${compact ? 'w-5 h-5 mr-1.5' : 'w-6 h-6 mr-2'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Tracking
                </h2>
                {!isEditingTracking && (
                  <div className="flex items-center gap-2">
                    {/* Pull live data from the carrier API */}
                    {order.trackingNumber && (
                      <button
                        onClick={handleSyncTracking}
                        disabled={syncingTracking}
                        className={`flex items-center gap-2 font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                        title="Pull the latest scan data from UPS and update this order"
                      >
                        {syncingTracking ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Syncing…
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Update Tracking
                          </>
                        )}
                      </button>
                    )}
                    {isStaffOrAdmin && (
                    <button
                      onClick={() => setIsEditingTracking(true)}
                      className={`flex items-center gap-2 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      {order.trackingNumber ? 'Edit' : 'Add'} Tracking
                    </button>
                    )}
                  </div>
                )}
              </div>

              {rerouteInsight && !order.trackingNumber && (
                <div className="mb-4">
                  <RerouteInsightBanner insight={rerouteInsight} compact={compact} />
                </div>
              )}

              {/* Sync status banner */}
              {syncMessage && (
                <div className={`mb-4 p-3 rounded-md flex items-start gap-2 ${
                  syncMessage.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <span className="text-lg leading-none">
                    {syncMessage.type === 'success' ? '✅' : '❌'}
                  </span>
                  <span>{syncMessage.text}</span>
                </div>
              )}

              {/* Edit tracking Success/Error Messages */}
              {trackingMessage && (
                <div className={`mb-4 p-3 rounded-md ${
                  trackingMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {trackingMessage.text}
                </div>
              )}

              {isEditingTracking && isStaffOrAdmin ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tracking Number *
                      </label>
                      <input
                        type="text"
                        value={editedTrackingNumber}
                        onChange={(e) => setEditedTrackingNumber(e.target.value)}
                        placeholder="e.g., 1Z999AA10123456784"
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Carrier
                      </label>
                      <select
                        value={editedCarrier}
                        onChange={(e) => setEditedCarrier(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="UPS">UPS</option>
                        <option value="FedEx">FedEx</option>
                        <option value="DHL">DHL</option>
                        <option value="USPS">USPS</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveTrackingNumber}
                      disabled={savingTracking}
                      className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium"
                    >
                      {savingTracking ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Save
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={savingTracking}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <label htmlFor="staff-delivery-status-tracking-edit" className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery status
                    </label>
                    <select
                      id="staff-delivery-status-tracking-edit"
                      value={coerceDeliveryStatusForDisplay(effectiveStatus)}
                      disabled={deliverySaving}
                      onChange={(e) => handleStaffDeliveryStatusChange(e.target.value)}
                      className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-60"
                    >
                      {DELIVERY_STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {deliverySaving && (
                      <span className="text-xs text-gray-500 mt-1 block">Saving…</span>
                    )}
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className={compact ? 'grid grid-cols-1 sm:grid-cols-3 gap-3' : 'grid grid-cols-3 gap-4'}>
                  <div>
                    <p className={`text-gray-600 mb-1 ${compact ? 'text-xs' : 'text-sm'}`}>Tracking Number</p>
                    {order.trackingNumber ? (
                      <p className={`font-mono font-semibold text-gray-900 break-all ${compact ? 'text-sm' : 'text-lg'}`}>{order.trackingNumber}</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-400 italic">Not assigned yet</p>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Pending</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className={`text-gray-600 mb-1 ${compact ? 'text-xs' : 'text-sm'}`}>Carrier</p>
                    <p className={`font-bold text-yellow-700 ${compact ? 'text-sm' : 'text-lg'}`}>{order.carrier || 'UPS'}</p>
                  </div>
                  <div>
                    <p className={`text-gray-600 mb-1 ${compact ? 'text-xs' : 'text-sm'}`}>Delivery status</p>
                    {isStaffOrAdmin ? (
                      <div className="mt-0.5">
                        <label htmlFor="staff-delivery-status-tracking" className="sr-only">
                          Delivery status
                        </label>
                        <select
                          id="staff-delivery-status-tracking"
                          value={coerceDeliveryStatusForDisplay(effectiveStatus)}
                          disabled={deliverySaving}
                          onChange={(e) => handleStaffDeliveryStatusChange(e.target.value)}
                          className={`w-full rounded-lg border border-gray-300 bg-white font-medium text-gray-900 shadow-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-60 ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
                        >
                          {DELIVERY_STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {deliverySaving && (
                          <span className="text-xs text-gray-500 mt-1 block">Saving…</span>
                        )}
                      </div>
                    ) : (
                      <span
                        className={`inline-block rounded-full font-semibold capitalize ${getStatusColor(effectiveStatus)} ${compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}
                        title="Your team sets this status; carrier updates do not change it automatically."
                      >
                        {effectiveStatus.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Shipping Route */}
            <div className={cardClass}>
              <div className={`flex items-center justify-between ${compact ? 'mb-2 flex-wrap gap-2' : 'mb-4 flex-wrap gap-2'}`}>
                <h2 className={`font-bold text-gray-900 flex items-center ${compact ? 'text-base' : 'text-xl'}`}>
                  <svg className={`text-red-600 ${compact ? 'w-5 h-5 mr-1.5' : 'w-6 h-6 mr-2'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Route
                </h2>
                {!isEditingRoute && isStaffOrAdmin ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingRoute(true)}
                    className={`flex items-center gap-2 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit origin / destination
                  </button>
                ) : null}
              </div>
              {isStaffOrAdmin && (
              <p className={`text-gray-500 ${compact ? 'text-xs mb-2' : 'text-xs mb-4'}`}>
                These values are saved to the database (and used on the map). Carrier sync may overwrite them with live scan locations.
              </p>
              )}
              {compact && (
                <p className="text-xs text-gray-500 mb-2">
                  Origin and destination may update when you use Update Tracking.
                </p>
              )}
              {routeMessage && (
                <div
                  className={`mb-4 p-3 rounded-md text-sm ${
                    routeMessage.type === 'success'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {routeMessage.text}
                </div>
              )}
              {isEditingRoute && isStaffOrAdmin ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
                      <input
                        type="text"
                        value={editedFromLocation}
                        onChange={(e) => setEditedFromLocation(e.target.value)}
                        placeholder="e.g. Ho Chi Minh City, Vietnam"
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
                      <input
                        type="text"
                        value={editedToLocation}
                        onChange={(e) => setEditedToLocation(e.target.value)}
                        placeholder="e.g. São Paulo, Brazil"
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleSaveRouteLocations}
                      disabled={savingRoute}
                      className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                    >
                      {savingRoute ? 'Saving…' : 'Save to database'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelRouteEdit}
                      disabled={savingRoute}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`flex items-center justify-between ${compact ? 'gap-2' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <div className={`bg-green-100 rounded-full shrink-0 ${compact ? 'p-2' : 'p-3'}`}>
                        <svg className={`text-green-600 ${compact ? 'w-4 h-4' : 'w-6 h-6'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                      </div>
                      <div className={`min-w-0 ${compact ? 'ml-2' : 'ml-4'}`}>
                        <p className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>Origin</p>
                        <p className={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-lg'}`}>{order.origin.country}</p>
                        {order.fromLocation && order.fromLocation !== order.origin.country && (
                          <p className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>{order.fromLocation}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={`flex-shrink-0 ${compact ? 'mx-1' : 'mx-4'}`}>
                    <svg className={`text-gray-400 ${compact ? 'w-5 h-5' : 'w-8 h-8'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <div className={`bg-blue-100 rounded-full shrink-0 ${compact ? 'p-2' : 'p-3'}`}>
                        <svg className={`text-blue-600 ${compact ? 'w-4 h-4' : 'w-6 h-6'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      </div>
                      <div className={`min-w-0 ${compact ? 'ml-2' : 'ml-4'}`}>
                        <p className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>Destination</p>
                        <p className={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-lg'}`}>{order.destination.country}</p>
                        {order.toLocation && order.toLocation !== order.destination.country && (
                          <p className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>{order.toLocation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isStaffOrAdmin && (
              <div className={`${cardClass} border-2 border-slate-200 ring-1 ring-slate-100`}>
                <div className={`flex items-center justify-between ${compact ? 'mb-2 flex-wrap gap-2' : 'mb-4 flex-wrap gap-2'}`}>
                  <h2 className={`font-bold text-gray-900 flex items-center ${compact ? 'text-base' : 'text-xl'}`}>
                    Staff: edit or delete shipment
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleToggleStaffShipmentEdit}
                      className={`font-medium text-white bg-slate-700 rounded-md hover:bg-slate-800 transition ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                    >
                      {staffShipmentEdit ? 'Close editor' : 'Edit full shipment'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteOrderOpen(true)}
                      className={`font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                    >
                      Delete order
                    </button>
                  </div>
                </div>
                <p className={`text-gray-600 ${compact ? 'text-xs mb-3' : 'text-sm mb-4'}`}>
                  Change package dimensions, parties, route labels, carrier, and tracking. Deleting removes the row from the database.
                </p>
                {staffShipmentMsg && (
                  <div
                    className={`mb-4 p-3 rounded-md text-sm ${
                      staffShipmentMsg.type === 'success'
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {staffShipmentMsg.text}
                  </div>
                )}
                {staffShipmentEdit && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sender name *</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffSenderName}
                          onChange={(e) => setStaffSenderName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Receiver name *</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffReceiverName}
                          onChange={(e) => setStaffReceiverName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sender phone</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffSenderPhone}
                          onChange={(e) => setStaffSenderPhone(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sender email</label>
                        <input
                          type="email"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffSenderEmail}
                          onChange={(e) => setStaffSenderEmail(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sender address</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffSenderAddress}
                          onChange={(e) => setStaffSenderAddress(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Receiver address</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffReceiverAddress}
                          onChange={(e) => setStaffReceiverAddress(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Package name</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffPackageName}
                          onChange={(e) => setStaffPackageName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Measurements text</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffMeasurements}
                          onChange={(e) => setStaffMeasurements(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg) *</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffWeight}
                          onChange={(e) => setStaffWeight(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gross weight (kg)</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffGrossWeight}
                          onChange={(e) => setStaffGrossWeight(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Length (cm)</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffLength}
                          onChange={(e) => setStaffLength(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Width (cm)</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffWidth}
                          onChange={(e) => setStaffWidth(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffHeight}
                          onChange={(e) => setStaffHeight(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Origin label *</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffFromLoc}
                          onChange={(e) => setStaffFromLoc(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Destination label *</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffToLoc}
                          onChange={(e) => setStaffToLoc(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffCarrier}
                          onChange={(e) => setStaffCarrier(e.target.value)}
                        >
                          {(['UPS', 'FedEx', 'DHL', 'USPS'] as const).map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tracking #</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                          value={staffTracking}
                          onChange={(e) => setStaffTracking(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Customer name (legacy)</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffCustomerName}
                          onChange={(e) => setStaffCustomerName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sender legacy</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={staffSenderLegacy}
                          onChange={(e) => setStaffSenderLegacy(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleSaveStaffShipment}
                        disabled={staffShipmentSaving}
                        className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
                      >
                        {staffShipmentSaving ? 'Saving…' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleStaffShipmentEdit}
                        className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sender & Receiver Information */}
            <div className={`grid grid-cols-1 md:grid-cols-2 ${compact ? 'gap-3' : 'gap-6'}`}>
              {/* Sender */}
              <div className={cardClass}>
                <h2 className={`font-bold text-gray-900 flex items-center ${compact ? 'text-base mb-2' : 'text-xl mb-4'}`}>
                  <svg className={`text-red-600 ${compact ? 'w-5 h-5 mr-1.5' : 'w-6 h-6 mr-2'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Sender
                </h2>
                <div className={compact ? 'space-y-2' : 'space-y-3'}>
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
              <div className={cardClass}>
                <h2 className={`font-bold text-gray-900 flex items-center ${compact ? 'text-base mb-2' : 'text-xl mb-4'}`}>
                  <svg className={`text-red-600 ${compact ? 'w-5 h-5 mr-1.5' : 'w-6 h-6 mr-2'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Receiver
                </h2>
                <div className={compact ? 'space-y-2' : 'space-y-3'}>
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
            <div className={cardClass}>
              <h2 className={`font-bold text-gray-900 flex items-center ${compact ? 'text-base mb-2' : 'text-xl mb-4'}`}>
                <svg className={`text-red-600 ${compact ? 'w-5 h-5 mr-1.5' : 'w-6 h-6 mr-2'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Package
              </h2>
              <div className={`grid grid-cols-2 md:grid-cols-4 ${compact ? 'gap-2' : 'gap-4'}`}>
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

            {isStaffOrAdmin && (
            <div className={cardClass}>
              <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                UPS Shipping Rate Quote
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Estimated prices from UPS Rating API · {rateRouteLabels.origin || order.origin.country} →{' '}
                {rateRouteLabels.destination || order.destination.country}
              </p>

              {rateLoading && (
                <div className="flex items-center gap-3 py-6 text-gray-500">
                  <svg className="animate-spin h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Fetching live rates from UPS…
                </div>
              )}

              {!rateLoading && rateData && !rateData.ok && (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded-md px-4 py-3 text-sm space-y-2">
                  <p className="font-semibold">Could not load UPS rates</p>
                  {rateData.hint && <p>{rateData.hint}</p>}
                  {!rateData.hint && typeof rateData.error === 'string' && <p>{rateData.error}</p>}
                  {!rateData.hint && typeof rateData.error !== 'string' && (
                    <p className="text-xs opacity-90 break-words">
                      {rateData.error != null
                        ? JSON.stringify(rateData.error).slice(0, 600)
                        : 'No details returned.'}
                    </p>
                  )}
                </div>
              )}

              {!rateLoading && rateData?.ok && rateData.rates && (
                <>
                  {/* Specs used */}
                  <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-500">
                    <span className="bg-gray-100 px-2 py-1 rounded">
                      📦 {rateData.packageSpecs?.dimensions}
                    </span>
                    <span className="bg-gray-100 px-2 py-1 rounded">
                      ⚖️ Actual {rateData.packageSpecs?.actualWeightKg} kg · Dim {rateData.packageSpecs?.dimensionalWeightKg} kg · Billable {rateData.packageSpecs?.billableWeightKg} kg
                    </span>
                    {rateData.exchangeRate && rateData.exchangeRate.from !== 'USD' && (
                      <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded">
                        💱 {rateData.exchangeRate.note}
                      </span>
                    )}
                  </div>

                  {/* Service rows */}
                  <div className="space-y-2">
                    {rateData.rates.map((r, i) => {
                      const isCheapest = i === 0;
                      return (
                        <div
                          key={r.serviceCode}
                          className={`flex items-center justify-between rounded-lg px-4 py-3 border transition ${
                            isCheapest
                              ? 'border-green-400 bg-green-50 ring-1 ring-green-400'
                              : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isCheapest && (
                              <span className="text-xs font-bold bg-green-500 text-white px-2 py-0.5 rounded-full">
                                BEST PRICE
                              </span>
                            )}
                            <span className={`font-medium text-sm ${isCheapest ? 'text-green-800' : 'text-gray-700'}`}>
                              {r.serviceName}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold text-base ${isCheapest ? 'text-green-700' : 'text-gray-800'}`}>
                              ${r.totalChargeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                            </p>
                            {r.currency !== 'USD' && (
                              <p className="text-xs text-gray-500">
                                {r.totalChargeLocal.toLocaleString()} {r.currency}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            )}
          </div>

          {/* Right Column - Timeline & Actions */}
          <div
            className={
              compact
                ? 'flex flex-col gap-3'
                : 'space-y-6'
            }
          >
            {/* Order Timeline */}
            <div className={`${cardClass} ${compact ? 'order-3' : ''}`}>
              <h2 className={`font-bold text-gray-900 flex items-center ${compact ? 'text-base mb-2' : 'text-xl mb-4'}`}>
                <svg className={`text-red-600 ${compact ? 'w-5 h-5 mr-1.5' : 'w-6 h-6 mr-2'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Timeline
              </h2>
              <div className={compact ? 'space-y-2' : 'space-y-4'}>
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className={`bg-green-500 rounded-full mt-1 ${compact ? 'w-2 h-2' : 'w-3 h-3'}`}></div>
                  </div>
                  <div className="ml-3">
                    <p className={`font-medium text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>Order Created</p>
                    <p className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>{new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                {order.submissionTime && order.submissionTime !== order.createdAt && (
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className={`bg-blue-500 rounded-full mt-1 ${compact ? 'w-2 h-2' : 'w-3 h-3'}`}></div>
                    </div>
                    <div className="ml-3">
                      <p className={`font-medium text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>Submitted</p>
                      <p className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>{new Date(order.submissionTime).toLocaleString()}</p>
                    </div>
                  </div>
                )}
                {order.updatedAt && order.updatedAt !== order.createdAt && (
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className={`bg-yellow-500 rounded-full mt-1 ${compact ? 'w-2 h-2' : 'w-3 h-3'}`}></div>
                    </div>
                    <div className="ml-3">
                      <p className={`font-medium text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>Last Updated</p>
                      <p className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>{new Date(order.updatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className={`${cardClass} ${compact ? 'order-2' : ''}`}>
              <h2 className={`font-bold text-gray-900 ${compact ? 'text-base mb-2' : 'text-xl mb-4'}`}>Quick Actions</h2>
              <div className={compact ? 'space-y-2' : 'space-y-3'}>
                <button
                  type="button"
                  onClick={() => order.trackingNumber && navigator.clipboard.writeText(order.trackingNumber)}
                  disabled={!order.trackingNumber}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
            <div className={`${summaryCardClass} ${compact ? 'order-1' : ''}`}>
              <h2 className={`font-bold ${compact ? 'text-base mb-2' : 'text-xl mb-4'}`}>Order Summary</h2>
              <div className={compact ? 'space-y-1.5 text-sm' : 'space-y-2'}>
                <div className="flex justify-between gap-2">
                  <span className="opacity-90 shrink-0">Order ID</span>
                  <span className="font-semibold text-right break-all text-xs sm:text-sm">{order.orderID}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-90">Delivery</span>
                  <span className="font-semibold capitalize">
                    {effectiveStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="opacity-90 shrink-0">Route</span>
                  <span className="font-semibold text-right text-xs">{order.origin.country} → {order.destination.country}</span>
                </div>
                <div className={`flex justify-between border-t border-white/20 ${compact ? 'pt-1.5 mt-1' : 'pt-2'}`}>
                  <span className="opacity-90">Weight</span>
                  <span className={`font-bold ${compact ? 'text-base' : 'text-lg'}`}>{order.grossWeight} kg</span>
                </div>
              </div>
            </div>

            {user &&
              (normalizeRole(user.role) === 'staff' ||
                normalizeRole(user.role) === 'admin') &&
              normalizeApprovalStatus(order.approvalStatus) === 'pending_review' && (
                <div className={`${cardClass} border-2 border-amber-300 ${compact ? 'order-4' : ''}`}>
                  <h2 className={`font-bold text-gray-900 mb-1 ${compact ? 'text-base' : 'text-lg'}`}>Order processing</h2>
                  <p className={`text-gray-600 mb-4 ${compact ? 'text-xs' : 'text-sm'}`}>
                    Approve to show this on the customer&apos;s Orders list, or reject it.
                  </p>
                  {reviewMessage && (
                    <div
                      className={`mb-4 text-sm px-3 py-2 rounded-lg ${
                        reviewMessage.type === 'success'
                          ? 'bg-green-50 text-green-800 border border-green-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}
                    >
                      {reviewMessage.text}
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      disabled={reviewProcessing}
                      onClick={handleApproveOrderReview}
                      className="flex-1 py-3 px-4 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {reviewProcessing ? 'Working…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      disabled={reviewProcessing}
                      onClick={handleRejectOrderReview}
                      className="flex-1 py-3 px-4 rounded-lg bg-white border-2 border-red-600 text-red-600 font-semibold hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

      {isStaffOrAdmin && deleteOrderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete this order?</h3>
            <p className="text-gray-600 mb-6 text-sm">
              Order <span className="font-mono font-semibold">{order.orderID}</span> will be removed permanently.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteOrderOpen(false)}
                disabled={deleteOrderBusy}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteOrder}
                disabled={deleteOrderBusy}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium disabled:opacity-60"
              >
                {deleteOrderBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
