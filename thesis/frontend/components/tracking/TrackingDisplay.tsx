'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import type { TrackingRerouteInsight } from '@/lib/tracking-reroute-insight';

export function RerouteInsightBanner({
  insight,
  compact = false,
}: {
  insight: TrackingRerouteInsight;
  compact?: boolean;
}) {
  const saved =
    insight.distanceSavedKm !== null && insight.distanceSavedKm > 0
      ? insight.distanceSavedKm
      : null;
  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 text-amber-950 ${
        compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'
      }`}
    >
      <p className={`font-semibold text-amber-900 ${compact ? 'text-xs' : 'text-sm'}`}>
        Hub reroute (active disruptions)
      </p>
      <p className={`mt-1 text-amber-800 ${compact ? 'text-xs' : 'text-sm'}`}>
        Affected by: {insight.blockedBy.length ? insight.blockedBy.join(', ') : 'zones on map'}
      </p>
      <ul className={`mt-2 space-y-0.5 text-amber-900 ${compact ? 'text-xs' : 'text-sm'}`}>
        <li>
          Optimal hub path: <strong>{insight.optimalHubKm} km</strong>
          {insight.secondBestHubKm !== null && (
            <span className="text-amber-800">
              {' '}
              (alternative feasible: {insight.secondBestHubKm} km)
            </span>
          )}
        </li>
        {saved !== null && (
          <li>
            Distance saved vs next feasible hub route: <strong>{saved} km</strong>
          </li>
        )}
        {insight.baselineClearNetworkKm !== null && insight.detourVsClearNetworkKm !== null && (
          <li>
            vs unconstrained hub network ({insight.baselineClearNetworkKm} km): detour{' '}
            <strong>
              {insight.detourVsClearNetworkKm >= 0 ? '+' : ''}
              {insight.detourVsClearNetworkKm} km
            </strong>
          </li>
        )}
        {insight.hubChain ? (
          <li className="text-amber-800 break-words">Route: {insight.hubChain}</li>
        ) : null}
      </ul>
    </div>
  );
}

interface TrackingActivity {
  timestamp: string;
  location: string;
  status: string;
  description: string;
}

interface TrackingInfo {
  trackingNumber: string;
  carrier: string;
  status: string;
  statusDescription: string;
  estimatedDelivery?: string;
  currentLocation?: string;
  activities: TrackingActivity[];
  shipperInfo?: {
    name?: string;
    location?: string;
  };
  recipientInfo?: {
    name?: string;
    location?: string;
  };
  packageDetails?: {
    weight?: string;
    service?: string;
  };
}

/** Maps raw UPS type codes → DB-friendly delivery status strings */
const UPS_CODE_TO_STATUS: Record<string, string> = {
  D:   'delivered',
  IT:  'in_transit',
  OT:  'in_transit',
  OFD: 'in_transit',
  I:   'in_transit',
  P:   'pending',
  DP:  'in_transit',
  OR:  'pending',
  M:   'in_transit', // Manifest pickup
  MV:  'in_transit',
  X:   'in_transit', // Exception
};

/**
 * Converts a raw UPS status code (type code or description string) to a
 * DB-friendly status.  If the code is unrecognised we fall back to parsing
 * the description text so a raw sub-status code like "011" never leaks into
 * the UI as a displayed status value.
 */
function normaliseStatus(raw: string, description?: string): string {
  // 1. Direct code lookup (handles "D", "IT", "I", "OFD", …)
  const fromCode = UPS_CODE_TO_STATUS[raw.toUpperCase()];
  if (fromCode) return fromCode;

  // 2. Parse the human-readable description as a fallback
  if (description) {
    const d = description.toLowerCase();
    if (d.includes('deliver')) return 'delivered';
    if (d.includes('out for delivery')) return 'in_transit';
    if (d.includes('transit') || d.includes('departed') || d.includes('arrived') ||
        d.includes('facility') || d.includes('loaded') || d.includes('processing'))
      return 'in_transit';
    if (d.includes('pickup') || d.includes('origin') || d.includes('manifest'))
      return 'in_transit';
  }

  // 3. Nothing matched — return empty string so the caller skips the update
  return '';
}

interface TrackingDisplayProps {
  trackingNumber: string;
  orderId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
  /** Called once (and on every refresh) with the live status + current location */
  onStatusUpdate?: (deliveryStatus: string, currentLocation?: string) => void;
  /** Hub-network reroute summary when map disruptions block the corridor / chord */
  rerouteInsight?: TrackingRerouteInsight | null;
}

export default function TrackingDisplay({
  trackingNumber,
  orderId,
  autoRefresh = false,
  refreshInterval = 300, // 5 minutes default
  onStatusUpdate,
  rerouteInsight = null,
}: TrackingDisplayProps) {
  const [trackingData, setTrackingData] = useState<TrackingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isMock, setIsMock] = useState(false);

  const fetchTrackingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      // Use order-specific endpoint if orderId provided, otherwise use general tracking
      const url = orderId
        ? `/api/orders/${orderId}/tracking`
        : `/api/tracking/${trackingNumber}`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        const data: TrackingInfo = response.data.data || response.data.trackingData;
        setTrackingData(data);
        setLastUpdated(new Date());
        setIsMock(response.data.source === 'mock');
        // Notify parent with the live status so it can update UI without waiting for DB sync
        if (onStatusUpdate && data?.status) {
          const norm = normaliseStatus(data.status, data.statusDescription);
          if (norm) onStatusUpdate(norm, data.currentLocation);
        }
      }
      // If success=false, leave trackingData null → empty history UI shows

      setLoading(false);
    } catch (err: any) {
      // Any API/network error → just show empty history, don't surface an error card
      console.warn('Could not retrieve tracking data:', err.response?.data?.message || err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackingData();

    // Set up auto-refresh if enabled
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchTrackingData();
      }, refreshInterval * 1000);

      return () => clearInterval(interval);
    }
  }, [trackingNumber, orderId, autoRefresh, refreshInterval]);

  const getStatusColor = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      delivered: 'bg-green-100 text-green-800',
      'in transit': 'bg-blue-100 text-blue-800',
      'out for delivery': 'bg-purple-100 text-purple-800',
      pending: 'bg-yellow-100 text-yellow-800',
      exception: 'bg-red-100 text-red-800',
      IT: 'bg-blue-100 text-blue-800',
      D: 'bg-green-100 text-green-800',
      DP: 'bg-blue-100 text-blue-800',
      OR: 'bg-gray-100 text-gray-800',
    };

    return statusMap[status.toLowerCase()] || statusMap[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string): string => {
    try {
      // UPS raw timestamp format: "YYYYMMDD HHMMSS" (e.g. "20260205 102800")
      const upsMatch = dateString.match(/^(\d{4})(\d{2})(\d{2})\s+(\d{2})(\d{2})(\d{2})$/);
      if (upsMatch) {
        const [, yr, mo, dy, hr, mn] = upsMatch;
        const date = new Date(`${yr}-${mo}-${dy}T${hr}:${mn}:00`);
        return date.toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
      }
      // Standard ISO / other parseable formats
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (loading && !trackingData) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
          <span className="ml-4 text-gray-600">Loading tracking information...</span>
        </div>
      </div>
    );
  }

  if (!trackingData) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <div className="text-4xl mb-3">📦</div>
        <h3 className="text-base font-semibold text-gray-700 mb-1">No Tracking History</h3>
        <p className="text-sm text-gray-400">
          No carrier data is available for this tracking number yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {rerouteInsight && <RerouteInsightBanner insight={rerouteInsight} />}

      {/* Mock data warning */}
      {isMock && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg px-4 py-3 text-sm">
          <span className="text-lg leading-none">⚠️</span>
          <div>
            <p className="font-semibold">Demo / placeholder data</p>
            <p className="text-yellow-700 mt-0.5">
              UPS credentials are not configured on this server. The tracking information below is
              simulated and does <strong>not</strong> reflect a real shipment.
            </p>
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-gradient-to-r from-red-600 to-red-800 text-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold mb-2">📦 Package Tracking</h2>
            <p className="text-red-100 text-sm">
              Tracking #{trackingData.trackingNumber}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-red-200">Carrier</span>
            <p className="text-lg font-semibold">{trackingData.carrier}</p>
          </div>
        </div>

        {lastUpdated && (
          <div className="mt-4 text-xs text-red-200">
            Last updated: {lastUpdated.toLocaleTimeString()}
            {autoRefresh && (
              <span className="ml-2">• Auto-refresh enabled</span>
            )}
          </div>
        )}
      </div>

      {/* Status Overview */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Current Status */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
              Current Status
            </h3>
            <span
              className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
                trackingData.status
              )}`}
            >
              {trackingData.statusDescription}
            </span>
          </div>

          {/* Current Location */}
          {trackingData.currentLocation && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                Current Location
              </h3>
              <p className="text-gray-900 font-medium">
                📍 {trackingData.currentLocation}
              </p>
            </div>
          )}

          {/* Estimated Delivery */}
          {trackingData.estimatedDelivery && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                Estimated Delivery
              </h3>
              <p className="text-gray-900 font-medium">
                🗓️ {new Date(trackingData.estimatedDelivery).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
        </div>

        {/* Package Details */}
        {trackingData.packageDetails && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
              Package Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {trackingData.packageDetails.service && (
                <div>
                  <span className="text-xs text-gray-500">Service</span>
                  <p className="text-gray-900 font-medium">
                    {trackingData.packageDetails.service}
                  </p>
                </div>
              )}
              {trackingData.packageDetails.weight && (
                <div>
                  <span className="text-xs text-gray-500">Weight</span>
                  <p className="text-gray-900 font-medium">
                    {trackingData.packageDetails.weight}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shipper and Recipient Info */}
        {(trackingData.shipperInfo || trackingData.recipientInfo) && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {trackingData.shipperInfo && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                    📤 Shipper
                  </h3>
                  {trackingData.shipperInfo.name && (
                    <p className="text-gray-900 font-medium">
                      {trackingData.shipperInfo.name}
                    </p>
                  )}
                  {trackingData.shipperInfo.location && (
                    <p className="text-gray-600 text-sm">
                      {trackingData.shipperInfo.location}
                    </p>
                  )}
                </div>
              )}
              {trackingData.recipientInfo && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                    📥 Recipient
                  </h3>
                  {trackingData.recipientInfo.name && (
                    <p className="text-gray-900 font-medium">
                      {trackingData.recipientInfo.name}
                    </p>
                  )}
                  {trackingData.recipientInfo.location && (
                    <p className="text-gray-600 text-sm">
                      {trackingData.recipientInfo.location}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tracking Timeline */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          📍 Tracking History
        </h3>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

          {/* Timeline items */}
          <div className="space-y-6">
            {trackingData.activities.map((activity, index) => (
              <div key={index} className="relative pl-14">
                {/* Timeline dot */}
                <div
                  className={`absolute left-4 w-5 h-5 rounded-full border-4 border-white ${
                    index === 0
                      ? 'bg-red-600'
                      : 'bg-gray-300'
                  }`}
                  style={{ top: '2px' }}
                ></div>

                {/* Activity content */}
                <div
                  className={`${
                    index === 0
                      ? 'bg-red-50 border-red-200'
                      : 'bg-gray-50 border-gray-200'
                  } border rounded-lg p-4`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {activity.description}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        📍 {activity.location}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm text-gray-600">
                        {formatDate(activity.timestamp)}
                      </p>
                      <span
                        className={`inline-flex px-2 py-1 rounded text-xs font-semibold mt-1 ${getStatusColor(
                          activity.status
                        )}`}
                      >
                        {activity.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <button
          onClick={fetchTrackingData}
          disabled={loading}
          className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              Refreshing...
            </>
          ) : (
            <>
              🔄 Refresh Tracking
            </>
          )}
        </button>
      </div>
    </div>
  );
}
