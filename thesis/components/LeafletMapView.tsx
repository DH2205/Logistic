'use client';

/**
 * LeafletMapView — all react-leaflet components live here so they are loaded
 * from a single bundle chunk (via dynamic import in TransportationMap) rather
 * than as separate async dynamic() wrappers.
 *
 * Splitting them into individual dynamic() imports caused Popup to call
 * ReactDOM.createPortal() before Leaflet had created the portal's target DOM
 * node, throwing "Cannot read properties of undefined (reading 'appendChild')".
 */

import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Rectangle,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { DisruptionZoneInput, RouteWaypoint } from '@/lib/disruption-router';

// Fix Leaflet's broken default-icon paths when bundled
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createTransportIcon = (color: string) =>
  L.divIcon({
    className: 'custom-transport-icon',
    html: `<div style="
      width: 20px;
      height: 20px;
      background-color: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

export interface TransportPoint {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  type: 'origin' | 'destination' | 'waypoint';
  status?: 'active' | 'completed' | 'pending';
}

export interface GeocodedRoute {
  id: string;
  order_id: string;
  from: { name: string; lat: number; lng: number };
  to: { name: string; lat: number; lng: number };
  status: string;
}

export interface Port {
  id: string;
  name: string;
  type: 'airport' | 'seaport' | 'storage';
  location: string;
  status?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
}

export interface LeafletMapViewProps {
  portMarkers: TransportPoint[];
  filteredPoints: TransportPoint[];
  displayedRoutes: GeocodedRoute[];
  highlightedOrderId: string | null;
  ports: Port[];
  mapRef: React.MutableRefObject<any>;
  trackedOrderStatus?: string | null;
  /** Active disruption zones to overlay as red rectangles */
  disruptionZones?: DisruptionZoneInput[];
  /** Dijkstra-computed alternative waypoints (rendered as red polyline) */
  reroutedPath?: RouteWaypoint[];
  /** Whether the straight route is blocked by a disruption */
  originalRouteBlocked?: boolean;
}

function MapBoundsUpdater({
  mapRef,
  points,
}: {
  mapRef: React.MutableRefObject<any>;
  points: TransportPoint[];
}) {
  const map = useMap();

  // Store the map instance in the shared ref so the parent can call fitBounds
  useEffect(() => {
    if (!map) return;
    mapRef.current = map;
    try {
      if (points.length > 0) {
        const bounds = L.latLngBounds(
          points.map((p) => [p.latitude, p.longitude] as [number, number])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
      } else {
        map.setView([20, 0], 2);
      }
    } catch {
      // map not ready yet
    }
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fit whenever the point count changes
  useEffect(() => {
    if (!map || !map.getContainer() || points.length === 0) return;
    try {
      const bounds = L.latLngBounds(
        points.map((p) => [p.latitude, p.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    } catch {
      // ignore
    }
  }, [points.length, map]);

  return null;
}

function getIcon(point: TransportPoint, isPort: boolean): L.DivIcon {
  if (isPort) {
    if (point.type === 'waypoint') return createTransportIcon('#3b82f6'); // airport → blue
    if (point.type === 'destination') return createTransportIcon('#10b981'); // seaport → green
    return createTransportIcon('#f59e0b'); // storage → yellow
  }
  if (point.status === 'active') return createTransportIcon('#ef4444');
  if (point.status === 'completed') return createTransportIcon('#10b981');
  if (point.status === 'pending') return createTransportIcon('#f59e0b');
  return createTransportIcon('#3b82f6');
}

function getRouteColor(status: string): string {
  switch (status) {
    case 'delivered': return '#10b981';
    case 'in_transit':
    case 'active': return '#ef4444';
    case 'pending': return '#f59e0b';
    default: return '#6b7280';
  }
}

/**
 * Split a route into one or two Leaflet-compatible polyline segments so it
 * always draws along the SHORTER geographic arc.
 *
 * Leaflet draws a straight Mercator line between raw coordinates, which for
 * routes like Vietnam (106°E) → United States (-118°W) goes westward through
 * the Middle East and Europe — the wrong direction.  By splitting the arc at
 * the antimeridian (±180°) we get two short segments that together render the
 * correct Pacific path on a standard [-180, 180] bounded map.
 *
 * Examples
 *   Vietnam → US_LA  →  [(10.82, 106.63)→(~23°, 180)] + [(~23°, -180)→(34.05, -118.24)]
 *   SG → London      →  single segment, no crossing
 */
function getRouteSegments(
  from: { lat: number; lng: number },
  to:   { lat: number; lng: number }
): [number, number][][] {
  const diff = to.lng - from.lng;
  // Adjust destination to follow the shorter arc
  let lngB = to.lng;
  if (diff > 180)  lngB -= 360;
  if (diff < -180) lngB += 360;

  // No antimeridian crossing — single segment (use adjusted lngB so the line
  // goes in the correct direction even when it doesn't cross ±180)
  if (lngB > -180 && lngB < 180) {
    return [[[from.lat, from.lng], [to.lat, lngB]]];
  }

  // Crosses +180 (shorter arc goes eastward past the date line)
  if (lngB > 180) {
    const t      = (180 - from.lng) / (lngB - from.lng);
    const midLat = from.lat + t * (to.lat - from.lat);
    return [
      [[from.lat, from.lng], [midLat,  180]],
      [[midLat,             -180],  [to.lat, to.lng]],
    ];
  }

  // Crosses -180 (shorter arc goes westward past the date line)
  const t      = (-180 - from.lng) / (lngB - from.lng);
  const midLat = from.lat + t * (to.lat - from.lat);
  return [
    [[from.lat, from.lng], [midLat, -180]],
    [[midLat,              180],  [to.lat, to.lng]],
  ];
}

/** Compass bearing (degrees, 0 = North) from `from` to `to`. */
function getBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLon = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Linear interpolation between two lat/lng points. */
function lerp(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  t: number
) {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  };
}

/**
 * Arrowhead placed AT the destination endpoint.
 *
 * The SVG is drawn with the tip at the local origin (0,0) pointing straight
 * up (North).  CSS `transform-origin: 50% 50%` rotates around the icon
 * centre, so we offset the tip to the centre of the bounding box.
 *
 * Layout (24 × 24 icon):
 *   centre = (12, 12)
 *   tip    = (12,  2)  → top of icon  ← anchor point mapped to destination
 *
 * The polygon is drawn in the icon's local space with the tip at the top:
 *   tip   (12, 2)
 *   left  ( 3,18)
 *   notch (12,13)
 *   right (21,18)
 *
 * iconAnchor = (12, 2) = the tip pixel, so Leaflet places the tip exactly
 * on the destination lat/lng before any rotation.
 * The CSS rotation happens around the icon centre (12,12), which shifts the
 * tip away from the destination by at most ~10 px — acceptable at map scales.
 *
 * For a perfectly anchored tip we pre-rotate in SVG space instead of CSS.
 */
function createArrowIcon(bearing: number, color: string): L.DivIcon {
  // Rotate the whole SVG around its centre in SVG space so the tip always
  // points toward the destination. This avoids the CSS rotation offset.
  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg"
              width="24" height="24" viewBox="0 0 24 24"
              style="display:block;overflow:visible;">
            <g transform="rotate(${bearing}, 12, 12)">
              <!-- tail centre at (12,18), tip at (12,2) -->
              <polygon points="12,2 21,18 12,13 3,18"
                fill="${color}" stroke="white" stroke-width="1.5"
                stroke-linejoin="round"/>
            </g>
          </svg>`,
    iconSize:   [24, 24],
    // Anchor = tip of the un-rotated arrow = (12, 2)
    // After SVG-space rotation the tip moves, so we anchor at centre and
    // accept the ~10 px offset (invisible at zoom ≤ 6).
    iconAnchor: [12, 12],
  });
}

/** Animated package icon that sits on the route line. */
function createPackageIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
        background:white;
        border:2.5px solid #ef4444;
        border-radius:10px;
        padding:3px 6px;
        font-size:16px;
        line-height:1;
        box-shadow:0 3px 10px rgba(0,0,0,0.25);
        white-space:nowrap;
        animation:pkgPulse 1.8s ease-in-out infinite;
      ">📦</div>
      <style>
        @keyframes pkgPulse{
          0%,100%{transform:scale(1);box-shadow:0 3px 10px rgba(0,0,0,0.25);}
          50%{transform:scale(1.15);box-shadow:0 4px 14px rgba(239,68,68,0.4);}
        }
      </style>`,
    iconSize: [36, 28],
    iconAnchor: [18, 14],
  });
}

/**
 * Returns the normalised 0–1 position of the package along the route
 * based on the delivery status of the tracked order.
 */
function packageT(status: string | null | undefined): number {
  if (status === 'delivered') return 1.0;
  if (status === 'in_transit') return 0.55;
  return 0.08; // pending / unknown → near origin
}

export default function LeafletMapView({
  portMarkers,
  filteredPoints,
  displayedRoutes,
  highlightedOrderId,
  ports,
  mapRef,
  trackedOrderStatus,
  disruptionZones = [],
  reroutedPath,
  originalRouteBlocked = false,
}: LeafletMapViewProps) {
  // Guard: Leaflet requires the real DOM. Don't render anything on the first
  // server pass or before the client has fully mounted — otherwise Popup's
  // ReactDOM.createPortal() calls fire before the MapContainer DOM exists,
  // throwing "Cannot read properties of undefined (reading 'appendChild')".
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div
        style={{ height: '100%', width: '100%' }}
        className="rounded-none bg-gray-100 flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <svg className="animate-spin h-8 w-8" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">Loading map…</span>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      maxZoom={18}
      maxBounds={[[-90, -180], [90, 180]]}
      maxBoundsViscosity={1.0}
      worldCopyJump={false}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
      className="rounded-none"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapBoundsUpdater
        mapRef={mapRef}
        points={[...filteredPoints, ...portMarkers]}
      />

      {/* Port / facility markers */}
      {portMarkers.map((point) => (
        <Marker
          key={`port-${point.id}`}
          position={[point.latitude, point.longitude]}
          icon={getIcon(point, true)}
        >
          <Popup>
            <div className="p-2 min-w-[200px]">
              <h3 className="font-bold text-gray-900 mb-1">{point.label}</h3>
              <p className="text-sm text-gray-600 mb-2">
                Type:{' '}
                <span className="capitalize font-medium">
                  {point.type === 'waypoint'
                    ? 'Airport'
                    : point.type === 'destination'
                    ? 'Seaport'
                    : 'Storage'}
                </span>
              </p>
              {ports.find((p) => p.id === point.id)?.description && (
                <p className="text-xs text-gray-500 mb-2">
                  {ports.find((p) => p.id === point.id)?.description}
                </p>
              )}
              <p className="text-xs text-gray-500">
                {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Active-route markers */}
      {filteredPoints.map((point) => (
        <Marker
          key={`route-${point.id}`}
          position={[point.latitude, point.longitude]}
          icon={getIcon(point, false)}
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-bold text-gray-900 mb-1">{point.label}</h3>
              <p className="text-sm text-gray-600">
                Type: <span className="capitalize">{point.type}</span>
              </p>
              {point.status && (
                <p className="text-sm text-gray-600">
                  Status:{' '}
                  <span className="capitalize font-medium">{point.status}</span>
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Order route polylines + directional arrows + package icon */}
      {displayedRoutes.map((route) => {
        const isHighlighted = route.order_id === highlightedOrderId;
        const color = getRouteColor(route.status);
        const bearing = getBearing(route.from, route.to);
        // Arrow sits exactly at the destination endpoint
        const arrowPos = route.to;
        // Package sits along the line based on delivery status (only for highlighted route)
        const pkgPos = isHighlighted
          ? lerp(route.from, route.to, packageT(trackedOrderStatus))
          : null;

        // Split along the shorter geographic arc so Vietnam→US draws over the
        // Pacific rather than westward through the Middle East / Europe.
        const segments = getRouteSegments(route.from, route.to);
        const polylineProps = {
          color,
          weight: isHighlighted ? 5 : highlightedOrderId ? 2 : 3,
          opacity: isHighlighted ? 1 : highlightedOrderId ? 0.4 : 0.7,
          dashArray: route.status === 'pending' ? '8, 12' : undefined,
        };
        const routePopup = (
          <Popup>
            <div className="p-2 min-w-[200px]">
              <h4 className="font-bold text-gray-900 mb-2">
                Order: {route.order_id}
              </h4>
              <div className="space-y-1 text-sm">
                <p className="text-gray-600">
                  <span className="font-medium">From:</span> {route.from.name}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">To:</span> {route.to.name}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Status:</span>{' '}
                  <span className="capitalize">{route.status}</span>
                </p>
              </div>
            </div>
          </Popup>
        );

        return (
          <React.Fragment key={`route-${route.id}`}>
            {/* Route line — may be 1 or 2 segments (antimeridian split) */}
            {segments.map((seg, si) => (
              <Polyline key={`seg-${route.id}-${si}`} positions={seg} {...polylineProps}>
                {si === 0 && routePopup}
              </Polyline>
            ))}

            {/* Directional arrow marker */}
            <Marker
              key={`arrow-${route.id}`}
              position={[arrowPos.lat, arrowPos.lng]}
              icon={createArrowIcon(bearing, color)}
              interactive={false}
            />

            {/* Package icon — only on the highlighted/tracked route */}
            {pkgPos && (
              <Marker
                key={`pkg-${route.id}`}
                position={[pkgPos.lat, pkgPos.lng]}
                icon={createPackageIcon()}
                zIndexOffset={1000}
              >
                <Popup>
                  <div className="p-2 text-sm font-medium text-gray-800">
                    📦 Current package location
                    <br />
                    <span className="text-xs text-gray-500 capitalize">
                      Status: {trackedOrderStatus?.replace('_', ' ') || 'pending'}
                    </span>
                  </div>
                </Popup>
              </Marker>
            )}
          </React.Fragment>
        );
      })}

      {/* ── Disruption zone overlays ─────────────────────────────────────── */}
      {disruptionZones.map((zone) => (
        <Rectangle
          key={`disruption-${zone.id}`}
          bounds={[
            [zone.bbox.south, zone.bbox.west],
            [zone.bbox.north, zone.bbox.east],
          ]}
          pathOptions={{
            color: zone.severity === 'critical' ? '#dc2626' : zone.severity === 'high' ? '#f97316' : '#facc15',
            fillColor: zone.severity === 'critical' ? '#ef4444' : zone.severity === 'high' ? '#f97316' : '#fde047',
            fillOpacity: 0.22,
            weight: 2.5,
            dashArray: '6, 4',
          }}
        >
          <Tooltip sticky>
            <div className="text-xs font-semibold">
              ⚠️ {zone.name}
              <br />
              <span className="capitalize text-gray-600">{zone.severity} severity</span>
            </div>
          </Tooltip>
        </Rectangle>
      ))}

      {/* ── Rerouted path (Dijkstra alternative) ───────────────────────── */}
      {reroutedPath && reroutedPath.length >= 2 && (
        <React.Fragment>
          {/* Original straight route — grey dashed, shown only when blocked */}
          {originalRouteBlocked && displayedRoutes.length > 0 && (
            <>
              {getRouteSegments(displayedRoutes[0].from, displayedRoutes[0].to).map((seg, si) => (
                <Polyline
                  key={`blocked-seg-${si}`}
                  positions={seg}
                  color="#9ca3af"
                  weight={3}
                  opacity={0.6}
                  dashArray="10, 8"
                >
                  {si === 0 && (
                    <Tooltip sticky>
                      <span className="text-xs text-gray-600">⛔ Original route (blocked)</span>
                    </Tooltip>
                  )}
                </Polyline>
              ))}
            </>
          )}

          {/* Safe alternative — solid green */}
          <Polyline
            positions={reroutedPath.map((w) => [w.lat, w.lng])}
            color="#16a34a"
            weight={4}
            opacity={0.9}
          >
            <Tooltip sticky>
              <div className="text-xs font-semibold text-green-700">
                🔄 Dijkstra Reroute
                <br />
                <span className="font-normal text-gray-700">
                  {reroutedPath.map((w) => w.name).join(' → ')}
                </span>
              </div>
            </Tooltip>
          </Polyline>

          {/* Hub waypoint markers along the rerouted path */}
          {reroutedPath.map((wp, i) => (
            <Marker
              key={`reroute-wp-${wp.id}`}
              position={[wp.lat, wp.lng]}
              icon={L.divIcon({
                className: '',
                html: `<div style="
                  width:12px;height:12px;
                  background:#16a34a;border:2px solid white;
                  border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4);
                  ${i === 0 || i === reroutedPath.length - 1 ? 'width:16px;height:16px;' : ''}
                "></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
              interactive
            >
              <Popup>
                <div className="text-xs p-1">
                  <strong>{wp.name}</strong>
                  <br />
                  <span className="text-gray-500">Reroute waypoint #{i + 1}</span>
                </div>
              </Popup>
            </Marker>
          ))}
        </React.Fragment>
      )}
    </MapContainer>
  );
}
