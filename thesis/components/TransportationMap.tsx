'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { locationsAPI } from '@/lib/api';
import { geocodeLocation, MAJOR_AIRPORTS } from '@/lib/geocoding';
import {
  regionToBbox,
  findReroute,
  directRouteBlocked,
  DEMO_DISRUPTION,
  DEMO_ORDER,
  DEMO_FROM,
  DEMO_TO,
  type DisruptionZoneInput,
  type RouteWaypoint,
  type BBox,
} from '@/lib/disruption-router';


interface TransportPoint {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  type: 'origin' | 'destination' | 'waypoint';
  status?: 'active' | 'completed' | 'pending';
}

interface OrderRoute {
  id: string;
  order_id: string;
  from_location: string;
  to_location: string;
  status: string;
  created_at: string;
}

interface GeocodedRoute {
  id: string;
  order_id: string;
  from: { name: string; lat: number; lng: number };
  to: { name: string; lat: number; lng: number };
  status: string;
}

interface Port {
  id: string;
  name: string;
  type: 'airport' | 'seaport' | 'storage';
  location: string;
  status?: 'operational' | 'maintenance' | 'closed';
  capacity?: number;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  address?: string;
  description?: string;
}

interface Report {
  id: string;
  title: string;
  type: 'delivery' | 'route' | 'performance';
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

interface TransportationMapProps {
  orderRoutes?: OrderRoute[];
  activeRoutes?: TransportPoint[];
  completedRoutes?: TransportPoint[];
  pendingRoutes?: TransportPoint[];
  ports?: Port[];
  reports?: Report[];
  showControls?: boolean;
}

// ── Disruption types ────────────────────────────────────────────────────────
type DisruptionType = 'storm' | 'natural_disaster' | 'war' | 'port_closure' | 'pandemic' | 'other';
type DisruptionSeverity = 'low' | 'medium' | 'high' | 'critical';

interface Disruption {
  id: string;
  type: DisruptionType;
  name: string;
  region: string;
  startTime: string;   // ISO datetime
  endTime: string;     // ISO datetime or '' (ongoing)
  severity: DisruptionSeverity;
  description: string;
  active: boolean;
  createdAt: string;
  bbox?: BBox;         // geographic bounding box (auto-computed from region)
}

const DISRUPTION_TYPE_META: Record<DisruptionType, { label: string; icon: string; color: string }> = {
  storm:            { label: 'Storm',            icon: '🌪️', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  natural_disaster: { label: 'Natural Disaster', icon: '🌋', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  war:              { label: 'War / Conflict',   icon: '⚔️', color: 'bg-red-100 text-red-800 border-red-300' },
  port_closure:     { label: 'Port Closure',     icon: '🚫', color: 'bg-gray-100 text-gray-800 border-gray-300' },
  pandemic:         { label: 'Pandemic',         icon: '🦠', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  other:            { label: 'Other',            icon: '⚠️', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
};

const SEVERITY_META: Record<DisruptionSeverity, { label: string; color: string }> = {
  low:      { label: 'Low',      color: 'bg-green-100 text-green-800' },
  medium:   { label: 'Medium',   color: 'bg-yellow-100 text-yellow-800' },
  high:     { label: 'High',     color: 'bg-orange-100 text-orange-800' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-800' },
};

const EMPTY_DISRUPTION: Omit<Disruption, 'id' | 'createdAt'> = {
  type: 'storm',
  name: '',
  region: '',
  startTime: '',
  endTime: '',
  severity: 'medium',
  description: '',
  active: true,
};

/** Manual coordinate fallback for regions not in the auto-lookup */
interface DisruptionCoords {
  centerLat: string;
  centerLng: string;
  radiusKm: string;
}
const EMPTY_COORDS: DisruptionCoords = { centerLat: '', centerLng: '', radiusKm: '' };

function coordsToBbox(lat: number, lng: number, radiusKm: number): BBox {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    north: lat + latDelta,
    south: lat - latDelta,
    east:  lng + lngDelta,
    west:  lng - lngDelta,
  };
}

// All react-leaflet components are bundled together in LeafletMapView and loaded
// as a single dynamic chunk to prevent the "appendChild of undefined" portal race.
const LeafletMapView = dynamic(
  () => import('./LeafletMapView'),
  { ssr: false }
);

export default function TransportationMap({
  orderRoutes = [],
  activeRoutes = [],
  completedRoutes = [],
  pendingRoutes = [],
  ports: initialPorts = [],
  reports = [],
  showControls = true,
}: TransportationMapProps) {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'completed' | 'pending'>('all');
  const [allPoints, setAllPoints] = useState<TransportPoint[]>([]);
  const [mounted, setMounted] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'ports' | 'reports' | 'testing'>('ports');
  const [ports, setPorts] = useState<Port[]>(initialPorts);
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [seedingPorts, setSeedingPorts] = useState(false);
  const [seedPortsMsg, setSeedPortsMsg] = useState<string | null>(null);
  const [selectedPortType, setSelectedPortType] = useState<'all' | 'airport' | 'seaport' | 'storage'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const mapRef = useRef<any>(null);
  const [leafletLib, setLeafletLib] = useState<any>(null);
  
  // Order routes states
  const [geocodedRoutes, setGeocodedRoutes] = useState<GeocodedRoute[]>([]);
  const [syntheticRoutesInfo, setSyntheticRoutesInfo] = useState<{ count: number } | null>(null);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  // Synthetic route built from UPS tracking data; overrides the stale DB route when set
  const [trackedOrderRoute, setTrackedOrderRoute] = useState<GeocodedRoute | null>(null);

  // Order tracking states
  const [trackingOrderId, setTrackingOrderId] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<any | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [syncingTrackedOrder, setSyncingTrackedOrder] = useState(false);
  
  // Use refs to track fetch status - these persist across renders and prevent re-fetching
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);

  // ── Disruption state ────────────────────────────────────────────────────────
  const [disruptions, setDisruptions] = useState<Disruption[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('logistics_disruptions');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showDisruptionForm, setShowDisruptionForm] = useState(false);
  const [disruptionForm, setDisruptionForm] = useState<Omit<Disruption, 'id' | 'createdAt'>>(EMPTY_DISRUPTION);
  const [disruptionCoords, setDisruptionCoords] = useState<DisruptionCoords>(EMPTY_COORDS);
  const [disruptionFormError, setDisruptionFormError] = useState<string | null>(null);

  const saveDisruptions = (next: Disruption[]) => {
    setDisruptions(next);
    try { localStorage.setItem('logistics_disruptions', JSON.stringify(next)); } catch { /* quota */ }
  };

  const addDisruption = () => {
    if (!disruptionForm.name.trim()) return setDisruptionFormError('Name is required.');
    if (!disruptionForm.region.trim()) return setDisruptionFormError('Region is required.');
    if (!disruptionForm.startTime) return setDisruptionFormError('Start time is required.');

    // Resolve bbox: auto-lookup first, manual coords as fallback
    let bbox: BBox | undefined = regionToBbox(disruptionForm.region) ?? undefined;
    if (!bbox) {
      const lat = parseFloat(disruptionCoords.centerLat);
      const lng = parseFloat(disruptionCoords.centerLng);
      const r   = parseFloat(disruptionCoords.radiusKm);
      if (!isNaN(lat) && !isNaN(lng) && !isNaN(r) && r > 0) {
        bbox = coordsToBbox(lat, lng, r);
      } else if (disruptionCoords.centerLat || disruptionCoords.centerLng || disruptionCoords.radiusKm) {
        return setDisruptionFormError(
          'Region not recognised — enter valid Center Lat, Center Lng and Radius to place it on the map.'
        );
      }
    }

    setDisruptionFormError(null);
    const next: Disruption = {
      ...disruptionForm,
      id: `dis-${Date.now()}`,
      createdAt: new Date().toISOString(),
      bbox,
    };
    saveDisruptions([next, ...disruptions]);
    setDisruptionForm(EMPTY_DISRUPTION);
    setDisruptionCoords(EMPTY_COORDS);
    setShowDisruptionForm(false);
  };

  const toggleDisruption = (id: string) =>
    saveDisruptions(disruptions.map(d => d.id === id ? { ...d, active: !d.active } : d));

  const deleteDisruption = (id: string) =>
    saveDisruptions(disruptions.filter(d => d.id !== id));

  /** Zoom the map to a disruption zone's bounding box */
  const focusOnZone = (d: Disruption) => {
    const bbox = d.bbox ?? regionToBbox(d.region) ?? regionToBbox(d.name);
    if (!bbox || !mapRef.current || !leafletLib) return;
    mapRef.current.fitBounds(
      [[bbox.south, bbox.west], [bbox.north, bbox.east]],
      { padding: [40, 40], maxZoom: 7 }
    );
  };

  const activeDisruptionCount = disruptions.filter(d => d.active).length;

  // ── Rerouting state ───────────────────────────────────────────────────────
  // reroutedPath: hub waypoints Dijkstra computed to avoid disruption zones
  // originalPathBlocked: true when the straight route crossed a zone
  const [reroutedPath, setReroutedPath] = useState<RouteWaypoint[] | null>(null);
  const [originalPathBlocked, setOriginalPathBlocked] = useState(false);
  const [rerouteInfo, setRerouteInfo] = useState<{
    extraKm: number;
    blockedBy: string[];
  } | null>(null);

  // Convert active disruptions to DisruptionZoneInput[].
  // If a disruption was saved without a bbox (e.g. region wasn't in the lookup
  // at the time it was created), try to compute it now on the fly.
  const activeDisruptionZones = useMemo((): DisruptionZoneInput[] =>
    disruptions
      .filter((d) => d.active)
      .map((d) => {
        const bbox = d.bbox ?? regionToBbox(d.region) ?? regionToBbox(d.name) ?? null;
        if (!bbox) return null;
        return { id: d.id, name: d.name, bbox, severity: d.severity };
      })
      .filter((d): d is DisruptionZoneInput => d !== null),
    [disruptions]
  );

  // Load Leaflet for utility methods (latLngBounds used in map zoom handlers)
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && !leafletLib) {
      import('leaflet').then((L) => setLeafletLib(L.default));
    }
  }, [leafletLib]);

  // Fetch ports from database - ONLY ONCE
  useEffect(() => {
    // Guard: if already fetched or currently fetching, exit immediately
    if (hasFetchedRef.current || isFetchingRef.current) {
      return;
    }

    // If initialPorts provided, use them
    if (initialPorts.length > 0) {
      setPorts(initialPorts);
      hasFetchedRef.current = true;
      return;
    }

    // If ports already in state, mark as fetched
    if (ports.length > 0) {
      hasFetchedRef.current = true;
      return;
    }

    // Mark as fetching to prevent duplicate calls
    isFetchingRef.current = true;
    setLoadingPorts(true);

    const fetchPorts = async () => {
      try {
        console.log('[TransportationMap] Fetching locations from API...');
        const response = await locationsAPI.getAll();
        const locations = response.data || [];
        
        // Convert locations to Port format
        const portsData: Port[] = locations.map((loc: any) => ({
          id: loc.id,
          name: loc.name,
          type: loc.type,
          location: loc.address || `${loc.city || ''}, ${loc.country || ''}`.trim() || 'Unknown',
          status: 'operational' as const,
          latitude: loc.latitude,
          longitude: loc.longitude,
          city: loc.city,
          country: loc.country,
          address: loc.address,
          description: loc.description,
        }));
        
        console.log(`[TransportationMap] Loaded ${portsData.length} locations successfully`);
        setPorts(portsData);
        hasFetchedRef.current = true;
      } catch (error: any) {
        console.error('[TransportationMap] Error fetching locations:', error);
        // If 404, log helpful message
        if (error?.response?.status === 404) {
          console.error('[TransportationMap] API endpoint not found. Please ensure /api/locations exists.');
        }
        // On error, allow retry after delay
        setTimeout(() => {
          isFetchingRef.current = false;
        }, 5000);
      } finally {
        setLoadingPorts(false);
        isFetchingRef.current = false;
      }
    };

    fetchPorts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // EMPTY ARRAY - only run once on mount

  /** Seed ~150 world airports / seaports / hubs into the DB then reload the list. */
  const handleSeedPorts = async () => {
    const token = localStorage.getItem('token');
    if (!token) { setSeedPortsMsg('Login required'); return; }
    setSeedingPorts(true);
    setSeedPortsMsg(null);
    try {
      const res = await fetch('/api/locations/seed', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
          if (d.inserted !== undefined) {
                            const errHint = d.errors?.length ? ` (${d.errors[0]})` : '';
                            setSeedPortsMsg(`✓ Added ${d.inserted} new, ${d.skipped} already existed${errHint}`);
                            // Reload the ports list
                            const loc = await fetch('/api/locations');
                            const locData = await loc.json();
                            if (Array.isArray(locData)) {
                              setPorts(locData.map((l: any) => ({
                                id: l.id,
                                name: l.name,
                                type: l.type,
                                location: l.city ? `${l.city}, ${l.country}` : (l.country || ''),
                                status: l.status || 'operational',
                                latitude: l.latitude,
                                longitude: l.longitude,
                                description: l.description,
                              })));
                            }
                          } else {
                            setSeedPortsMsg('Error: ' + (d.error || d.details || 'unknown'));
                          }
    } catch (e: any) {
      setSeedPortsMsg('Error: ' + e.message);
    } finally {
      setSeedingPorts(false);
    }
  };

  // Geocode order routes when they change
  useEffect(() => {
    if (!orderRoutes || orderRoutes.length === 0) {
      setGeocodedRoutes([]);
      return;
    }

    const geocodeRoutes = async () => {
      setRoutesLoading(true);
      console.log(`[TransportationMap] Geocoding ${orderRoutes.length} routes...`);

      const geocoded: GeocodedRoute[] = [];
      
      // Limit to first 500 routes for performance (you can adjust this)
      const routesToProcess = orderRoutes.slice(0, 500);

      for (const route of routesToProcess) {
        const fromCoords = await geocodeLocation(route.from_location);
        const toCoords = await geocodeLocation(route.to_location);

        if (fromCoords && toCoords) {
          geocoded.push({
            id: route.id,
            order_id: route.order_id,
            from: {
              name: route.from_location,
              lat: fromCoords.lat,
              lng: fromCoords.lng,
            },
            to: {
              name: route.to_location,
              lat: toCoords.lat,
              lng: toCoords.lng,
            },
            status: route.status,
          });
        } else {
          console.warn(`[TransportationMap] Could not geocode route ${route.order_id}: ${route.from_location} -> ${route.to_location}`);
        }

        // Small delay to avoid overwhelming the geocoding service (if using API)
        // MAJOR_AIRPORTS cache makes this fast for most routes
        if (!MAJOR_AIRPORTS[route.from_location] || !MAJOR_AIRPORTS[route.to_location]) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      console.log(`[TransportationMap] Successfully geocoded ${geocoded.length} out of ${routesToProcess.length} routes`);
      setGeocodedRoutes(geocoded);
      setRoutesLoading(false);
    };

    geocodeRoutes();
  }, [orderRoutes]);

  // Function to track order by ID
  const handleTrackOrder = async () => {
    if (!trackingOrderId.trim()) {
      setTrackingError('Please enter an order ID');
      return;
    }

    setTrackingLoading(true);
    setTrackingError(null);
    setTrackedOrder(null);
    setTrackedOrderRoute(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setTrackingError('Please login to track orders');
        return;
      }

      const orderId = trackingOrderId.trim();
      console.log('📦 Tracking order:', orderId);

      // ── Demo shortcut — no DB needed ──────────────────────────────────────
      if (orderId.toUpperCase() === 'DEMO-SG-LONDON') {
        setTrackedOrder(DEMO_ORDER);
        setHighlightedOrderId('DEMO-SG-LONDON');
        // Build the synthetic route straight away from hardcoded coords
        setTrackedOrderRoute({
          id: 'demo-route',
          order_id: 'DEMO-SG-LONDON',
          from: { name: 'Singapore', lat: DEMO_FROM.lat, lng: DEMO_FROM.lng },
          to:   { name: 'London, GB', lat: DEMO_TO.lat, lng: DEMO_TO.lng },
          status: 'in_transit',
        });
        return; // skip DB / UPS calls
      }

      // Step 1 — Quick DB look-up so we get the canonical ORD-… id.
      // The user may have typed a UPS tracking number instead.
      const trackResponse = await fetch(`/api/orders/track/${orderId}`);
      if (!trackResponse.ok) {
        throw new Error(
          trackResponse.status === 404
            ? 'Order not found. Please check the Order ID.'
            : 'Failed to fetch order details. Please try again.'
        );
      }
      const initialOrder = await trackResponse.json();
      const canonicalOrderId: string = initialOrder.orderId ?? orderId;
      console.log('✅ Order found:', canonicalOrderId);

      // Show the order immediately so the map highlights while we sync.
      setTrackedOrder(initialOrder);
      setHighlightedOrderId(canonicalOrderId);

      // Step 2 — AWAIT the UPS sync so the status is always accurate.
      // trackingLoading keeps the submit button disabled during this wait.
      setSyncingTrackedOrder(true);
      try {
        const refreshResponse = await fetch(
          `/api/orders/${canonicalOrderId}/refresh`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' } }
        );
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          if (refreshData?.order) {
            const merged = mergeRefreshData(refreshData.order, refreshData.trackingUpdate);
            console.log('📍 Fresh UPS data:', merged.deliveryStatus ?? merged.status, '|', merged.fromLocation, '→', merged.toLocation);
            setTrackedOrder(merged);
          }
        } else {
          console.warn('⚠️ UPS sync returned', refreshResponse.status, '— keeping initial data');
        }
      } catch {
        console.warn('⚠️ UPS sync failed — keeping initial data');
      } finally {
        setSyncingTrackedOrder(false);
      }

      // Step 3 — Disruption check & Dijkstra reroute (runs client-side, instant).
      setReroutedPath(null);
      setOriginalPathBlocked(false);
      setRerouteInfo(null);

      // Step 3 — If the DB route already exists, zoom to it.
      // The trackedOrderRoute useEffect will zoom to the UPS-derived route once geocoded.
      const matchingRoute = geocodedRoutes.find(r => r.order_id === canonicalOrderId);
      if (matchingRoute && mapRef.current && leafletLib) {
        try {
          const bounds = leafletLib.latLngBounds([
            [matchingRoute.from.lat, matchingRoute.from.lng],
            [matchingRoute.to.lat, matchingRoute.to.lng],
          ]);
          mapRef.current.fitBounds(bounds, { padding: [100, 100], maxZoom: 5 });
        } catch { /* map not ready */ }
      }

      console.log('✅ Tracking complete');
    } catch (error: any) {
      console.error('❌ Error tracking order:', error);
      setTrackingError(error.message || 'Failed to track order');
    } finally {
      setTrackingLoading(false);
    }
  };

  // Clear tracking when switching tabs or entering new ID
  const handleTrackingIdChange = (value: string) => {
    setTrackingOrderId(value);
    if (trackingError) setTrackingError(null);
  };
  
  // Function to clear route highlighting and show all routes
  const handleShowAllRoutes = () => {
    setHighlightedOrderId(null);
    setTrackedOrder(null);
    setTrackingOrderId('');
    setTrackingError(null);
    
    // Reset map view to show all routes
    if (mapRef.current && leafletLib && geocodedRoutes.length > 0) {
      try {
        const allPoints = geocodedRoutes.flatMap(r => [
          [r.from.lat, r.from.lng],
          [r.to.lat, r.to.lng],
        ]);
        const bounds = leafletLib.latLngBounds(allPoints as any);
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 3 });
      } catch (error) {
        console.warn('Could not reset map view:', error);
      }
    }
  };

  // ── Synthetic route generator for performance testing ───────────────────────
  const generateSyntheticRoutes = (count: number): GeocodedRoute[] => {
    const hubs = [
      { name: 'Singapore', lat: 1.35, lng: 103.82 },
      { name: 'Mumbai', lat: 18.92, lng: 72.83 },
      { name: 'Dubai', lat: 25.20, lng: 55.27 },
      { name: 'Cairo', lat: 30.04, lng: 31.24 },
      { name: 'London', lat: 51.51, lng: -0.13 },
      { name: 'New York', lat: 40.71, lng: -74.01 },
      { name: 'Los Angeles', lat: 34.05, lng: -118.24 },
      { name: 'Tokyo', lat: 35.68, lng: 139.65 },
    ];

    const routes: GeocodedRoute[] = [];
    for (let i = 0; i < count; i++) {
      const a = hubs[i % hubs.length];
      const b = hubs[(i * 3 + 1) % hubs.length];
      const status =
        i % 3 === 0 ? 'in_transit' : i % 3 === 1 ? 'delivered' : 'pending';
      routes.push({
        id: `SYN-${i}`,
        order_id: `SYN-ORD-${i}`,
        from: { name: a.name, lat: a.lat, lng: a.lng },
        to: { name: b.name, lat: b.lat, lng: b.lng },
        status,
      });
    }
    return routes;
  };

  const loadSyntheticRoutes = (count: number) => {
    const synthetic = generateSyntheticRoutes(count);
    setGeocodedRoutes(synthetic);
    setHighlightedOrderId(null);
    setTrackedOrder(null);
    setTrackedOrderRoute(null);
    setSyntheticRoutesInfo({ count });

    if (mapRef.current && leafletLib && synthetic.length > 0) {
      try {
        const allPoints = synthetic.flatMap((r) => [
          [r.from.lat, r.from.lng],
          [r.to.lat, r.to.lng],
        ]);
        const bounds = leafletLib.latLngBounds(allPoints as any);
        mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 3 });
      } catch {
        /* ignore */
      }
    }
  };

  useEffect(() => {
    // Combine all route points
    const points: TransportPoint[] = [
      ...activeRoutes.map(p => ({ ...p, status: 'active' as const })),
      ...completedRoutes.map(p => ({ ...p, status: 'completed' as const })),
      ...pendingRoutes.map(p => ({ ...p, status: 'pending' as const })),
    ];
    setAllPoints(points);
  }, [activeRoutes, completedRoutes, pendingRoutes]);

  // Memoize filtered points to prevent unnecessary recalculations
  const filteredPoints = useMemo(() => {
    return selectedFilter === 'all' 
      ? allPoints 
      : allPoints.filter(p => p.status === selectedFilter);
  }, [allPoints, selectedFilter]);

  // Filter ports by type and search query - MEMOIZED
  const filteredPorts = useMemo(() => {
    return ports.filter(port => {
      const matchesType = selectedPortType === 'all' || port.type === selectedPortType;
      const matchesSearch = searchQuery === '' || 
        port.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        port.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        port.country?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        port.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [ports, selectedPortType, searchQuery]);

  // Create map markers from ports - MEMOIZED
  const portMarkers = useMemo(() => {
    return filteredPorts
      .filter(p => p.latitude && p.longitude)
      .map(port => ({
        id: port.id,
        latitude: port.latitude!,
        longitude: port.longitude!,
        label: port.name,
        type: port.type === 'airport' ? 'waypoint' as const : port.type === 'seaport' ? 'destination' as const : 'origin' as const,
        status: 'active' as const,
      }));
  }, [filteredPorts]);

  // In focused tracking mode (Reports tab after Track), hide unrelated port/facility markers
  // so users only see the selected shipment path.
  const visiblePortMarkers = useMemo(() => {
    if (highlightedOrderId) return [];
    return portMarkers;
  }, [highlightedOrderId, portMarkers]);

  // Filter routes to display.
  // When an order is highlighted we show only its route.
  // If a synthetic route (built from live UPS data) exists for the highlighted order,
  // it replaces any stale route from the DB.
  const displayedRoutes = useMemo(() => {
    if (highlightedOrderId) {
      // If we have a UPS-derived synthetic route for this order, show ONLY that —
      // it carries the correct origin/destination/status and we don't want the stale
      // DB route drawn on top of it (DB routes have different IDs so a simple id-filter
      // would never remove them).
      if (trackedOrderRoute && trackedOrderRoute.order_id === highlightedOrderId) {
        return [trackedOrderRoute];
      }
      // No synthetic route yet — fall back to whatever the DB has
      return geocodedRoutes.filter(r => r.order_id === highlightedOrderId);
    }
    return geocodedRoutes;
  }, [geocodedRoutes, highlightedOrderId, trackedOrderRoute]);

  // Route point markers should follow the same focus behavior as polylines.
  // When tracking a specific order, only render markers for that order's route.
  const visibleRoutePoints = useMemo(() => {
    if (!highlightedOrderId) {
      return filteredPoints;
    }

    const statusForPoint = (status: string): 'active' | 'completed' | 'pending' => {
      const s = (status || '').toLowerCase();
      if (s === 'delivered' || s === 'completed') return 'completed';
      if (s === 'in_transit' || s === 'active') return 'active';
      return 'pending';
    };

    return displayedRoutes.flatMap((route) => ([
      {
        id: `${route.id}-from`,
        latitude: route.from.lat,
        longitude: route.from.lng,
        label: route.from.name,
        type: 'origin' as const,
        status: statusForPoint(route.status),
      },
      {
        id: `${route.id}-to`,
        latitude: route.to.lat,
        longitude: route.to.lng,
        label: route.to.name,
        type: 'destination' as const,
        status: statusForPoint(route.status),
      },
    ]));
  }, [highlightedOrderId, filteredPoints, displayedRoutes]);

  // Whenever trackedOrder changes (initial fetch OR after background refresh),
  // (re-)build a synthetic GeocodedRoute from the live UPS location strings.
  // fromLocation / toLocation are written by sync-tracking, so after the first
  // background refresh they reflect the real UPS origin and current/delivered location.
  useEffect(() => {
    if (!trackedOrder) {
      setTrackedOrderRoute(null);
      return;
    }

    const fromLoc: string =
      trackedOrder.fromLocation ||
      (typeof trackedOrder.origin === 'object' ? trackedOrder.origin?.country : trackedOrder.origin) ||
      '';
    const toLoc: string =
      trackedOrder.toLocation ||
      (typeof trackedOrder.destination === 'object' ? trackedOrder.destination?.country : trackedOrder.destination) ||
      '';

    if (!fromLoc && !toLoc) return;

    (async () => {
      const [fromCoords, toCoords] = await Promise.all([
        fromLoc ? geocodeLocation(fromLoc) : Promise.resolve(null),
        toLoc ? geocodeLocation(toLoc) : Promise.resolve(null),
      ]);

      if (!fromCoords || !toCoords) {
        console.warn(`[TransportationMap] Could not geocode tracked order locations: "${fromLoc}" → "${toLoc}"`);
        return;
      }

      const orderId: string = trackedOrder.orderId ?? highlightedOrderId ?? 'tracked';
      setTrackedOrderRoute({
        id: `ups-${orderId}`,
        order_id: orderId,
        from: { name: fromLoc, lat: fromCoords.lat, lng: fromCoords.lng },
        to:   { name: toLoc,   lat: toCoords.lat,   lng: toCoords.lng   },
        status: trackedOrder.deliveryStatus || trackedOrder.status || 'pending',
      });
    })();
  }, [trackedOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom the map to the synthetic (UPS-derived) route whenever it is built or updated
  useEffect(() => {
    if (!trackedOrderRoute || !mapRef.current || !leafletLib) return;
    try {
      const bounds = leafletLib.latLngBounds([
        [trackedOrderRoute.from.lat, trackedOrderRoute.from.lng],
        [trackedOrderRoute.to.lat,   trackedOrderRoute.to.lng],
      ]);
      mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 5 });
      console.log(`✅ Map zoomed to UPS route: ${trackedOrderRoute.from.name} → ${trackedOrderRoute.to.name}`);
    } catch {
      // map not ready yet
    }
  }, [trackedOrderRoute]); // eslint-disable-line react-hooks/exhaustive-deps

  // Disruption rerouting — runs whenever the displayed route or active disruptions change
  useEffect(() => {
    if (!trackedOrderRoute || activeDisruptionZones.length === 0) {
      setReroutedPath(null);
      setOriginalPathBlocked(false);
      setRerouteInfo(null);
      return;
    }

    const fromLat = trackedOrderRoute.from.lat;
    const fromLng = trackedOrderRoute.from.lng;
    const toLat   = trackedOrderRoute.to.lat;
    const toLng   = trackedOrderRoute.to.lng;

    const blocked = directRouteBlocked(fromLat, fromLng, toLat, toLng, activeDisruptionZones);
    setOriginalPathBlocked(blocked);

    if (!blocked) {
      setReroutedPath(null);
      setRerouteInfo(null);
      return;
    }

    // Compute alternative via Dijkstra
    const result = findReroute(fromLat, fromLng, toLat, toLng, activeDisruptionZones);
    if (result.waypoints.length >= 2) {
      setReroutedPath(result.waypoints);
      const directKm = Math.round(
        Math.sqrt((toLat - fromLat) ** 2 + (toLng - fromLng) ** 2) * 111
      );
      setRerouteInfo({
        extraKm: Math.round(result.totalDistanceKm - directKm),
        blockedBy: activeDisruptionZones.map((d) => d.name),
      });
      console.log(`🔄 Rerouted: ${result.waypoints.map((w) => w.name).join(' → ')}`);
    }
  }, [trackedOrderRoute, activeDisruptionZones]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Re-fetches the latest data for the currently tracked order from the DB
   * (after calling sync-tracking so carrier data is fresh).  Used by the
   * manual "Sync" button and by the auto-refresh interval.
   */
  /**
   * Shared helper: merge live UPS fields from a /refresh response into the
   * order object so the status / locations are correct even when the DB write
   * inside sync-tracking fails silently (RLS / network).
   */
  const mergeRefreshData = (order: any, trackingUpdate: any): any => {
    if (!order) return order;
    const liveStatus: string | null = trackingUpdate?.derivedStatus ?? null;
    const currentStatus: string = order.deliveryStatus || order.status || 'pending';
    return {
      ...order,
      deliveryStatus: (liveStatus && liveStatus !== 'pending' && currentStatus === 'pending')
        ? liveStatus : order.deliveryStatus,
      status: (liveStatus && liveStatus !== 'pending' && (!order.status || order.status === 'pending'))
        ? liveStatus : order.status,
      fromLocation: order.fromLocation || trackingUpdate?.originLocation || null,
      toLocation: order.toLocation || trackingUpdate?.latestLocation || null,
    };
  };

  const syncTrackedOrder = async (orderId: string) => {
    if (!orderId) return;
    setSyncingTrackedOrder(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/refresh`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data?.order) {
          const merged = mergeRefreshData(data.order, data.trackingUpdate);
          setTrackedOrder(merged);
          console.log(`[Map] Synced tracked order ${orderId}: ${merged.deliveryStatus || merged.status}`);
        }
      }
    } catch {
      // silent – non-critical
    } finally {
      setSyncingTrackedOrder(false);
    }
  };

  /**
   * While an order is highlighted, poll every 30 s so changes made elsewhere
   * (e.g. "Update Tracking" on the order detail page) propagate to this map.
   */
  useEffect(() => {
    if (!highlightedOrderId) return;

    const interval = setInterval(() => {
      syncTrackedOrder(highlightedOrderId);
    }, 30_000);

    return () => clearInterval(interval);
  }, [highlightedOrderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update map bounds when filtered points or ports change - use LENGTHS only to prevent loops
  useEffect(() => {
    if (mapRef.current && leafletLib && mounted) {
      const allMapPoints = [...filteredPoints, ...portMarkers];
      if (allMapPoints.length > 0) {
        try {
          const bounds = leafletLib.latLngBounds(
            allMapPoints.map(p => [p.latitude, p.longitude] as [number, number])
          );
          mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
        } catch (error) {
          // Ignore bounds errors
        }
      } else {
        mapRef.current.setView([20, 0], 2);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPoints.length, portMarkers.length, leafletLib, mounted]); // Only depend on lengths


  const getStatusCounts = () => {
    return {
      active: activeRoutes.length,
      completed: completedRoutes.length,
      pending: pendingRoutes.length,
      total: allPoints.length,
      airports: ports.filter(p => p.type === 'airport').length,
      seaports: ports.filter(p => p.type === 'seaport').length,
      storage: ports.filter(p => p.type === 'storage').length,
    };
  };

  const counts = getStatusCounts();

  const getPortStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'bg-green-100 text-green-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      case 'closed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getReportStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!mounted) {
    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">Transportation Map</h2>
        </div>
        <div className="flex items-center justify-center" style={{ height: '600px' }}>
          <div className="text-gray-500">Loading map...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="px-6 py-5 border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-1">Transportation Map</h2>
            <p className="text-sm text-gray-500">Track shipments and manage logistics</p>
          </div>
          {showControls && (
            <div className="flex gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
              <button
                onClick={() => setSelectedFilter('all')}
                className={`px-5 py-2.5 rounded-md font-semibold text-sm transition-all duration-200 ${
                  selectedFilter === 'all'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-transparent text-gray-700 hover:bg-gray-100'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedFilter('active')}
                className={`px-5 py-2.5 rounded-md font-semibold text-sm transition-all duration-200 ${
                  selectedFilter === 'active'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-transparent text-gray-700 hover:bg-gray-100'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setSelectedFilter('pending')}
                className={`px-5 py-2.5 rounded-md font-semibold text-sm transition-all duration-200 ${
                  selectedFilter === 'pending'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-transparent text-gray-700 hover:bg-gray-100'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setSelectedFilter('completed')}
                className={`px-5 py-2.5 rounded-md font-semibold text-sm transition-all duration-200 ${
                  selectedFilter === 'completed'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-transparent text-gray-700 hover:bg-gray-100'
                }`}
              >
                Completed
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="flex" style={{ height: '650px' }}>
        {/* Left Half - Map */}
        <div className="w-1/2 border-r-2 border-gray-200 relative bg-gray-50">
          {/* Map Legend */}
          <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-3 border border-gray-200 min-w-[170px]">
            <h4 className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Legend</h4>

            {/* Status bar */}
            {routesLoading && (
              <div className="mb-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                🔄 Loading shipment routes…
              </div>
            )}
            {!routesLoading && highlightedOrderId && (
              <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 font-medium leading-tight">
                <span className="block text-amber-500 text-[10px] uppercase tracking-wide mb-0.5">Tracking</span>
                {trackedOrderRoute
                  ? `${trackedOrderRoute.from.name} → ${trackedOrderRoute.to.name}`
                  : 'Active Shipment'}
              </div>
            )}
            {!routesLoading && !highlightedOrderId && geocodedRoutes.length > 0 && (
              <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800 font-medium">
                <span className="block text-green-500 text-[10px] uppercase tracking-wide mb-0.5">Shipments on map</span>
                {geocodedRoutes.length} order{geocodedRoutes.length !== 1 ? 's' : ''} visualised
              </div>
            )}

            {/* Facility types */}
            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">Facilities</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-sm flex-shrink-0"></div>
                <span className="text-xs text-gray-600">Air Freight Hub</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white shadow-sm flex-shrink-0"></div>
                <span className="text-xs text-gray-600">Sea Port / Terminal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-yellow-500 border-2 border-white shadow-sm flex-shrink-0"></div>
                <span className="text-xs text-gray-600">Warehouse / DC</span>
              </div>
            </div>

            {/* Route status colours */}
            {filteredPoints.length > 0 && (
              <>
                <div className="border-t border-gray-100 my-2"></div>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">Shipment Status</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white shadow-sm flex-shrink-0"></div>
                    <span className="text-xs text-gray-600">In Transit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-yellow-400 border-2 border-white shadow-sm flex-shrink-0"></div>
                    <span className="text-xs text-gray-600">Pending Dispatch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm flex-shrink-0"></div>
                    <span className="text-xs text-gray-600">Delivered</span>
                  </div>
                </div>
              </>
            )}

            {/* Disruption indicators */}
            {activeDisruptionZones.length > 0 && (
              <>
                <div className="border-t border-gray-100 my-2"></div>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">Disruptions</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-2 rounded-sm bg-red-400 opacity-60 flex-shrink-0 border border-red-600"></div>
                    <span className="text-xs text-gray-600">Conflict / Closure Zone</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 border-t-2 border-dashed border-gray-400 flex-shrink-0"></div>
                    <span className="text-xs text-gray-600">Blocked Route</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 border-t-2 border-solid border-green-600 flex-shrink-0"></div>
                    <span className="text-xs text-gray-600">Rerouted Path</span>
                  </div>
                </div>
              </>
            )}
          </div>
          
          <LeafletMapView
            portMarkers={visiblePortMarkers}
            filteredPoints={visibleRoutePoints}
            displayedRoutes={displayedRoutes}
            highlightedOrderId={highlightedOrderId}
            ports={ports}
            mapRef={mapRef}
            trackedOrderStatus={
              trackedOrder
                ? (trackedOrder.deliveryStatus || trackedOrder.status || null)
                : null
            }
            disruptionZones={activeDisruptionZones}
            reroutedPath={reroutedPath ?? undefined}
            originalRouteBlocked={originalPathBlocked}
          />
        </div>

        {/* Right Half - Ports & Reports */}
        <div className="w-1/2 flex flex-col bg-gradient-to-br from-gray-50 to-white">
          {/* Tabs */}
          <div className="flex border-b-2 border-gray-200 bg-white shadow-sm">
            <button
              onClick={() => setSelectedTab('ports')}
              className={`flex-1 px-6 py-4 font-semibold text-sm transition-all duration-200 relative ${
                selectedTab === 'ports'
                  ? 'text-red-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Ports & Facilities
              {selectedTab === 'ports' && (
                <span className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full"></span>
              )}
            </button>
            <button
              onClick={() => setSelectedTab('reports')}
              className={`flex-1 px-6 py-4 font-semibold text-sm transition-all duration-200 relative ${
                selectedTab === 'reports'
                  ? 'text-red-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Reports
              {selectedTab === 'reports' && (
                <span className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full"></span>
              )}
            </button>
            <button
              onClick={() => setSelectedTab('testing')}
              className={`flex-1 px-4 py-4 font-semibold text-sm transition-all duration-200 relative ${
                selectedTab === 'testing'
                  ? 'text-orange-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                Disruptions
                {activeDisruptionCount > 0 && (
                  <span className="bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {activeDisruptionCount}
                  </span>
                )}
              </span>
              {selectedTab === 'testing' && (
                <span className="absolute bottom-0 left-0 right-0 h-1 bg-orange-500 rounded-t-full"></span>
              )}
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedTab === 'testing' ? (
              /* ── Disruption Testing Panel ─────────────────────────────── */
              <div className="space-y-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">Global Disruptions</h3>
                    <p className="text-sm text-gray-500">
                      Record active disruptions (storms, conflicts, natural disasters…) for route-impact analysis.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {/* Demo Scenario button */}
                    <button
                      onClick={() => {
                        // 1. Save the demo disruption with its bbox
                        const demo: Disruption = {
                          id: DEMO_DISRUPTION.id,
                          type: 'war',
                          name: DEMO_DISRUPTION.name,
                          region: 'Iran, Persian Gulf, Gulf of Oman, Arabian Sea',
                          severity: 'critical',
                          startTime: '2026-01-01T00:00',
                          endTime: '',
                          description: 'Active armed conflict in the Persian Gulf region. All commercial shipping and air freight suspended.',
                          active: true,
                          createdAt: new Date().toISOString(),
                          bbox: DEMO_DISRUPTION.bbox,
                        };
                        const alreadyExists = disruptions.some(d => d.id === DEMO_DISRUPTION.id);
                        if (!alreadyExists) saveDisruptions([demo, ...disruptions]);
                        // 2. Pre-fill tracking input, switch to Reports tab, then auto-track
                        setTrackingOrderId('DEMO-SG-LONDON');
                        setSelectedTab('reports');
                        // Auto-track after state flushes (next tick)
                        setTimeout(() => {
                          setTrackedOrder(null);
                          setTrackedOrderRoute(null);
                          setTrackingLoading(true);
                          setTrackedOrder(DEMO_ORDER);
                          setHighlightedOrderId('DEMO-SG-LONDON');
                          setTrackedOrderRoute({
                            id: 'demo-route',
                            order_id: 'DEMO-SG-LONDON',
                            from: { name: 'Singapore', lat: DEMO_FROM.lat, lng: DEMO_FROM.lng },
                            to:   { name: 'London, GB', lat: DEMO_TO.lat, lng: DEMO_TO.lng },
                            status: 'in_transit',
                          });
                          setTrackingLoading(false);
                        }, 50);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg font-semibold text-xs hover:bg-purple-700 transition-colors shadow-sm whitespace-nowrap"
                      title="Load the Singapore → London demo to see Dijkstra rerouting in action"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      Load Demo
                    </button>
                    <button
                      onClick={() => { setShowDisruptionForm(v => !v); setDisruptionFormError(null); }}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold text-sm hover:bg-orange-600 transition-colors shadow-sm whitespace-nowrap"
                    >
                      {showDisruptionForm ? '✕ Cancel' : '+ Add Disruption'}
                    </button>
                  </div>
                </div>

                {/* ── Add Form ── */}
                {showDisruptionForm && (
                  <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-5 space-y-4">
                    <h4 className="font-bold text-gray-900 text-base">New Disruption Event</h4>

                    {disruptionFormError && (
                      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        ⚠️ {disruptionFormError}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      {/* Name */}
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Event Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. Typhoon Mawar, Red Sea Conflict…"
                          value={disruptionForm.name}
                          onChange={e => setDisruptionForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400"
                        />
                      </div>

                      {/* Type */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Type *</label>
                        <select
                          value={disruptionForm.type}
                          onChange={e => setDisruptionForm(f => ({ ...f, type: e.target.value as DisruptionType }))}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400"
                        >
                          {(Object.keys(DISRUPTION_TYPE_META) as DisruptionType[]).map(k => (
                            <option key={k} value={k}>{DISRUPTION_TYPE_META[k].icon} {DISRUPTION_TYPE_META[k].label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Severity */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Severity *</label>
                        <select
                          value={disruptionForm.severity}
                          onChange={e => setDisruptionForm(f => ({ ...f, severity: e.target.value as DisruptionSeverity }))}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400"
                        >
                          {(Object.keys(SEVERITY_META) as DisruptionSeverity[]).map(k => (
                            <option key={k} value={k}>{SEVERITY_META[k].label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Region */}
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Affected Region / Country *</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="e.g. Red Sea, Philippines, Eastern Europe…"
                            value={disruptionForm.region}
                            onChange={e => setDisruptionForm(f => ({ ...f, region: e.target.value }))}
                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 pr-24"
                          />
                          {disruptionForm.region.trim() && (
                            <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                              regionToBbox(disruptionForm.region)
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {regionToBbox(disruptionForm.region) ? '✓ Recognised' : '? Unknown'}
                            </span>
                          )}
                        </div>
                        {disruptionForm.region.trim() && !regionToBbox(disruptionForm.region) && (
                          <p className="mt-1 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                            Region not in auto-lookup — fill in the coordinates below to draw it on the map.
                          </p>
                        )}
                      </div>

                      {/* Manual coordinates (shown when region not auto-recognised) */}
                      {disruptionForm.region.trim() && !regionToBbox(disruptionForm.region) && (
                        <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-semibold text-blue-800">📍 Draw Zone on Map</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Center Lat *</label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="e.g. 14.6"
                                value={disruptionCoords.centerLat}
                                onChange={e => setDisruptionCoords(c => ({ ...c, centerLat: e.target.value }))}
                                className="w-full px-2 py-1.5 border border-blue-300 rounded text-sm focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Center Lng *</label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="e.g. 121.0"
                                value={disruptionCoords.centerLng}
                                onChange={e => setDisruptionCoords(c => ({ ...c, centerLng: e.target.value }))}
                                className="w-full px-2 py-1.5 border border-blue-300 rounded text-sm focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Radius (km) *</label>
                              <input
                                type="number"
                                step="10"
                                min="10"
                                placeholder="e.g. 500"
                                value={disruptionCoords.radiusKm}
                                onChange={e => setDisruptionCoords(c => ({ ...c, radiusKm: e.target.value }))}
                                className="w-full px-2 py-1.5 border border-blue-300 rounded text-sm focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                          {disruptionCoords.centerLat && disruptionCoords.centerLng && disruptionCoords.radiusKm && (
                            <p className="text-xs text-blue-700">
                              ✓ Zone will cover approx. {parseFloat(disruptionCoords.radiusKm) * 2 || '?'} km × {parseFloat(disruptionCoords.radiusKm) * 2 || '?'} km centred at ({disruptionCoords.centerLat}, {disruptionCoords.centerLng})
                            </p>
                          )}
                        </div>
                      )}

                      {/* Start Time */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Start Date & Time *</label>
                        <input
                          type="datetime-local"
                          value={disruptionForm.startTime}
                          onChange={e => setDisruptionForm(f => ({ ...f, startTime: e.target.value }))}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400"
                        />
                      </div>

                      {/* End Time */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">End Date & Time <span className="text-gray-400">(leave blank if ongoing)</span></label>
                        <input
                          type="datetime-local"
                          value={disruptionForm.endTime}
                          onChange={e => setDisruptionForm(f => ({ ...f, endTime: e.target.value }))}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400"
                        />
                      </div>

                      {/* Description */}
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                        <textarea
                          rows={2}
                          placeholder="Brief notes about the disruption…"
                          value={disruptionForm.description}
                          onChange={e => setDisruptionForm(f => ({ ...f, description: e.target.value }))}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 resize-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => { setShowDisruptionForm(false); setDisruptionForm(EMPTY_DISRUPTION); setDisruptionCoords(EMPTY_COORDS); setDisruptionFormError(null); }}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addDisruption}
                        className="px-5 py-2 text-sm font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors shadow-sm"
                      >
                        Save Disruption
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Stats Row ── */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white border border-gray-200 rounded-lg p-3 text-center shadow-sm">
                    <p className="text-2xl font-bold text-gray-900">{disruptions.length}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Total Logged</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-orange-600">{activeDisruptionCount}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Active Now</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {disruptions.filter(d => d.active && d.severity === 'critical').length}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Critical</p>
                  </div>
                </div>

                {/* ── Disruption List ── */}
                {disruptions.length === 0 ? (
                  <div className="text-center py-14 bg-white rounded-xl border-2 border-dashed border-gray-200">
                    <div className="text-5xl mb-3">🌐</div>
                    <p className="text-gray-700 font-medium">No disruptions logged</p>
                    <p className="text-sm text-gray-500 mt-1">Click "Add Disruption" to record a global event</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {disruptions.map(d => {
                      const meta = DISRUPTION_TYPE_META[d.type];
                      const sev  = SEVERITY_META[d.severity];
                      const isOngoing = !d.endTime;
                      const fmt = (iso: string) => iso
                        ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—';
                      return (
                        <div
                          key={d.id}
                          className={`bg-white rounded-xl border-2 p-4 transition-all ${
                            d.active ? 'border-orange-200 shadow-sm' : 'border-gray-100 opacity-60'
                          }`}
                        >
                          {/* Header row */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xl flex-shrink-0">{meta.icon}</span>
                              <div className="min-w-0">
                                <p className="font-bold text-gray-900 truncate">{d.name}</p>
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 flex-wrap">
                                  📍 {d.region}
                                  {(d.bbox ?? regionToBbox(d.region) ?? regionToBbox(d.name))
                                    ? <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">🗺 on map</span>
                                    : <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">no zone</span>
                                  }
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${sev.color}`}>
                                {sev.label}
                              </span>
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${meta.color}`}>
                                {meta.label}
                              </span>
                            </div>
                          </div>

                          {/* Time window */}
                          <div className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 mb-3 flex flex-wrap gap-x-4 gap-y-1">
                            <span>🕐 Start: <span className="font-medium text-gray-800">{fmt(d.startTime)}</span></span>
                            <span>
                              {isOngoing
                                ? <span className="font-medium text-orange-600">⚡ Ongoing</span>
                                : <>🏁 End: <span className="font-medium text-gray-800">{fmt(d.endTime)}</span></>}
                            </span>
                          </div>

                          {/* Description */}
                          {d.description && (
                            <p className="text-xs text-gray-600 mb-3 leading-relaxed">{d.description}</p>
                          )}

                          {/* Actions */}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => toggleDisruption(d.id)}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                                  d.active
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {d.active ? '✓ Active' : '○ Inactive'}
                              </button>
                              {(d.bbox ?? regionToBbox(d.region) ?? regionToBbox(d.name)) && (
                                <button
                                  onClick={() => focusOnZone(d)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                  title="Zoom map to this zone"
                                >
                                  🔍 Focus
                                </button>
                              )}
                            </div>
                            <button
                              onClick={() => deleteDisruption(d.id)}
                              className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              🗑 Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            ) : selectedTab === 'ports' ? (
              <div className="space-y-4">
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-xl font-bold text-gray-900">Ports & Facilities</h3>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={handleSeedPorts}
                        disabled={seedingPorts}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                        title="Insert ~150 real-world airports, seaports and logistics hubs"
                      >
                        {seedingPorts ? (
                          <>
                            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            Seeding…
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"/>
                            </svg>
                            Seed World Ports
                          </>
                        )}
                      </button>
                      {seedPortsMsg && <span className="text-xs text-gray-600">{seedPortsMsg}</span>}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">Manage and monitor port operations</p>
                  
                  {/* Search Bar */}
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Search ports by name, city, or country..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all text-sm"
                    />
                  </div>
                  
                  {/* Port Type Filter */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    <button
                      onClick={() => setSelectedPortType('all')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedPortType === 'all'
                          ? 'bg-red-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      All ({ports.length})
                    </button>
                    <button
                      onClick={() => setSelectedPortType('airport')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedPortType === 'airport'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Airports ({ports.filter(p => p.type === 'airport').length})
                    </button>
                    <button
                      onClick={() => setSelectedPortType('seaport')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedPortType === 'seaport'
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Seaports ({ports.filter(p => p.type === 'seaport').length})
                    </button>
                    <button
                      onClick={() => setSelectedPortType('storage')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedPortType === 'storage'
                          ? 'bg-yellow-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Storage ({ports.filter(p => p.type === 'storage').length})
                    </button>
                  </div>
                </div>
                {loadingPorts ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600"></div>
                    <p className="text-gray-500 mt-2">Loading ports...</p>
                  </div>
                ) : filteredPorts.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
                    <div className="text-5xl mb-3">🔍</div>
                    <p className="text-gray-700 font-medium">
                      {searchQuery ? 'No ports found matching your search' : 'No ports data available'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {searchQuery ? 'Try a different search term' : 'Ports will appear here when data is added'}
                    </p>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="mb-3 text-sm text-gray-600">
                      Showing {filteredPorts.length} of {ports.length} ports
                    </div>
                    {filteredPorts.map((port) => {
                      const typeColors = {
                      airport: 'bg-blue-100 text-blue-800 border-blue-200',
                      seaport: 'bg-green-100 text-green-800 border-green-200',
                      storage: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                    };
                    
                    return (
                      <div
                        key={port.id}
                        className="bg-white rounded-xl shadow-sm p-5 border-2 border-gray-100 hover:border-red-300 hover:shadow-xl transition-all duration-200 cursor-pointer group"
                        onClick={() => {
                          if (port.latitude && port.longitude && mapRef.current) {
                            mapRef.current.setView([port.latitude, port.longitude], 8);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-bold text-gray-900 text-lg group-hover:text-red-600 transition-colors">
                                {port.name}
                              </h4>
                              {port.type === 'airport' && <span className="text-xl">✈️</span>}
                              {port.type === 'seaport' && <span className="text-xl">🚢</span>}
                              {port.type === 'storage' && <span className="text-xl">📦</span>}
                            </div>
                            <p className="text-sm text-gray-600 flex items-center gap-1 mb-1">
                              <span>📍</span>
                              {port.location || `${port.city || ''}, ${port.country || ''}`.trim() || 'Location not specified'}
                            </p>
                            {port.description && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {port.description}
                              </p>
                            )}
                          </div>
                          <span
                            className={`px-3 py-1.5 text-xs font-bold rounded-full shadow-sm ${getPortStatusColor(port.status || 'operational')}`}
                          >
                            {port.status?.toUpperCase() || 'OPERATIONAL'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                          <span className={`text-xs font-semibold capitalize px-3 py-1.5 rounded-full border ${typeColors[port.type] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                            {port.type}
                          </span>
                          {port.city && port.country && (
                            <span className="text-xs text-gray-600">
                              {port.city}, {port.country}
                            </span>
                          )}
                          {port.capacity && (
                            <span className="text-xs font-medium text-gray-600 bg-gray-50 px-3 py-1 rounded-full">
                              Capacity: {port.capacity}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">Track Your Order</h3>
                  <p className="text-sm text-gray-500 mb-4">Enter your Order ID or UPS tracking number to track package progress</p>
                  
                  {/* Order ID Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Order ID (ORD-…) or tracking number (1Z…)"
                      value={trackingOrderId}
                      onChange={(e) => handleTrackingIdChange(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleTrackOrder()}
                      className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all text-sm"
                    />
                    <button
                      onClick={handleTrackOrder}
                      disabled={trackingLoading}
                      className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      {trackingLoading
                        ? (syncingTrackedOrder ? '⏳ Syncing UPS…' : '🔄 Looking up…')
                        : '🔍 Track'}
                    </button>
                  </div>

                  {/* Error Message */}
                  {trackingError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      ⚠️ {trackingError}
                    </div>
                  )}
                  
                  {/* Show All Routes Button */}
                  {highlightedOrderId && (
                    <div className="mt-3">
                      <button
                        onClick={handleShowAllRoutes}
                        className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <span>🗺️</span>
                        Show All Routes
                      </button>
                    </div>
                  )}
                </div>

                {/* Synthetic routes performance testing panel (local-only, no DB writes) */}
                <div className="mb-6 border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50/60">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">
                        Performance Testing — Synthetic Routes
                      </h4>
                      <p className="text-xs text-gray-500">
                        Load in-memory demo routes (500–5000) to measure FPS and rendering limits.
                      </p>
                    </div>
                    {syntheticRoutesInfo && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                        {syntheticRoutesInfo.count.toLocaleString()} synthetic routes loaded
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[250, 500, 750, 1000].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => loadSyntheticRoutes(n)}
                        className="px-3 py-1.5 rounded-lg border text-xs font-semibold text-gray-700 bg-white hover:bg-blue-50 hover:border-blue-400 transition-colors"
                        title={`Load ${n} synthetic routes into the map (client-only)`}
                      >
                        {n.toLocaleString()} routes
                      </button>
                    ))}
                    {syntheticRoutesInfo && (
                      <button
                        type="button"
                        onClick={() => {
                          setSyntheticRoutesInfo(null);
                          setGeocodedRoutes([]);
                          if (mapRef.current && leafletLib) {
                            try {
                              mapRef.current.setView([20, 0], 2);
                            } catch { /* ignore */ }
                          }
                        }}
                        className="ml-auto px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-600 bg-white hover:bg-gray-100 transition-colors"
                      >
                        Clear synthetic routes
                      </button>
                    )}
                  </div>
                </div>

                {/* Tracked Order Details */}
                {trackedOrder ? (
                  // effectiveStatus: prefer delivery_status (set by UPS sync) over the
                  // order-level status which may still be the stale "pending" value.
                  (() => {
                    const effectiveStatus: string =
                      trackedOrder.deliveryStatus || trackedOrder.status || 'pending';
                    const statusBadge =
                      effectiveStatus === 'delivered'   ? 'bg-green-100 text-green-700' :
                      effectiveStatus === 'in_transit'  ? 'bg-blue-100 text-blue-700'  :
                      effectiveStatus === 'processing'  ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700';

                    return (
                  <div className="space-y-3">
                    {/* Compact Header with Order ID and Status */}
                    <div className={`bg-white border-l-4 ${effectiveStatus === 'delivered' ? 'border-green-500' : effectiveStatus === 'in_transit' ? 'border-blue-500' : 'border-red-600'} rounded-lg p-4 shadow-sm`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 mb-1">Order ID</p>
                          <p className="font-bold text-gray-900 text-sm truncate">{trackedOrder.orderId}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${syncingTrackedOrder ? 'bg-yellow-100 text-yellow-700' : statusBadge}`}>
                            {syncingTrackedOrder ? 'SYNCING…' : effectiveStatus.toUpperCase().replace(/_/g, ' ')}
                          </span>
                          {/* Manual sync button — re-fetches carrier data & updates all fields */}
                          <button
                            onClick={() => highlightedOrderId && syncTrackedOrder(highlightedOrderId)}
                            disabled={syncingTrackedOrder}
                            title="Sync latest tracking data from carrier"
                            className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 hover:bg-green-100 hover:text-green-700 text-gray-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <svg
                              className={`w-4 h-4 ${syncingTrackedOrder ? 'animate-spin' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── Disruption / Reroute Alert ───────────────────── */}
                    {originalPathBlocked && reroutedPath && reroutedPath.length >= 2 && (
                      <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 space-y-2 shadow">
                        <div className="flex items-center gap-2 font-bold text-red-700 text-sm">
                          <span className="text-lg">⚠️</span>
                          Route Disrupted — Alternative Path Calculated
                        </div>
                        {rerouteInfo && (
                          <p className="text-xs text-red-600">
                            Blocked by: <strong>{rerouteInfo.blockedBy.join(', ')}</strong>
                            {rerouteInfo.extraKm > 0 && ` · Detour adds ~${rerouteInfo.extraKm.toLocaleString()} km`}
                          </p>
                        )}
                        <div className="bg-white rounded-lg p-3 border border-red-200 text-xs text-gray-700">
                          <span className="font-semibold text-red-700">Dijkstra Reroute: </span>
                          {reroutedPath.map((w, i) => (
                            <span key={w.id}>
                              {i > 0 && <span className="text-red-400 mx-1">→</span>}
                              <span className="font-medium">{w.name}</span>
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500">
                          Map shows the original route in grey (dashed) and the safe alternative in red.
                        </p>
                      </div>
                    )}

                    {/* Tracking Information */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                      <h6 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
                        🗺️ Tracking Information
                      </h6>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Tracking Number</p>
                          <p className="font-semibold text-gray-900 text-sm font-mono text-xs break-all">
                            {trackedOrder.trackingNumber ||
                              (trackingOrderId && !trackingOrderId.startsWith('ORD-')
                                ? trackingOrderId
                                : 'N/A')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Status</p>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${statusBadge}`}>
                            {effectiveStatus.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Shipping Route - Compact */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                      <h6 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
                        📍 Shipping Route
                      </h6>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm">
                            ↑
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Origin</p>
                            <p className="font-semibold text-gray-900 text-sm">
                              {trackedOrderRoute?.from.name ||
                                trackedOrder.fromLocation ||
                                trackedOrder.origin?.country ||
                                'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="text-gray-400 text-xl">→</div>
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          <div>
                            <p className="text-xs text-gray-500 text-right">Destination</p>
                            <p className="font-semibold text-gray-900 text-sm text-right">
                              {trackedOrderRoute?.to.name ||
                                trackedOrder.toLocation ||
                                trackedOrder.destination?.country ||
                                'N/A'}
                            </p>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm">
                            ↓
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sender & Receiver - More Detailed */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Sender */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                        <h6 className="font-bold text-gray-900 mb-2 text-sm flex items-center gap-2">
                          👤 Sender
                        </h6>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-gray-500">Name</p>
                            <p className="text-sm font-medium text-gray-900">{trackedOrder.senderName || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Phone</p>
                            <p className="text-sm text-gray-700">{trackedOrder.senderPhone || 'N/A'}</p>
                          </div>
                          {trackedOrder.senderEmail && (
                            <div>
                              <p className="text-xs text-gray-500">Email</p>
                              <p className="text-sm text-gray-700 truncate">{trackedOrder.senderEmail}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Receiver */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                        <h6 className="font-bold text-gray-900 mb-2 text-sm flex items-center gap-2">
                          📦 Receiver
                        </h6>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-gray-500">Name</p>
                            <p className="text-sm font-medium text-gray-900">{trackedOrder.receiverName || 'N/A'}</p>
                          </div>
                          {trackedOrder.receiverAddress && (
                            <div>
                              <p className="text-xs text-gray-500">Address</p>
                              <p className="text-sm text-gray-700 line-clamp-2">{trackedOrder.receiverAddress}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Package Content & Details */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                      <h6 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
                        📦 Package Content
                      </h6>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Dimensions</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {trackedOrder.length || 0}×{trackedOrder.width || 0}×{trackedOrder.height || 0} cm
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Weight</p>
                          <p className="text-sm font-semibold text-gray-900">{trackedOrder.weight || 0} kg</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Gross Weight</p>
                          <p className="text-sm font-semibold text-gray-900">{trackedOrder.grossWeight || trackedOrder.weight || 0} kg</p>
                        </div>
                      </div>
                    </div>

                    {/* Current Location */}
                    <div className={`rounded-lg p-4 border ${effectiveStatus === 'delivered' ? 'bg-green-50 border-green-200' : effectiveStatus === 'in_transit' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                      <h6 className="font-bold text-gray-900 mb-2 text-sm flex items-center gap-2">
                        📍 Current Location
                      </h6>
                      <p className="text-sm text-gray-700 font-medium">
                        {effectiveStatus === 'delivered'
                          ? `✅ Delivered at ${trackedOrderRoute?.to.name || trackedOrder.toLocation || trackedOrder.destination?.country || 'destination'}`
                          : effectiveStatus === 'in_transit'
                          ? `🚚 In transit · last seen at ${trackedOrderRoute?.to.name || trackedOrder.toLocation || 'unknown'}`
                          : `⏳ Pending at ${trackedOrderRoute?.from.name || trackedOrder.fromLocation || trackedOrder.origin?.country || 'origin'}`
                        }
                      </p>
                    </div>

                    {/* Timeline / Travel Log - Placeholder */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                      <h6 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
                        ⏱️ Timeline
                      </h6>
                      <div className="space-y-3">
                        {trackedOrder.createdAt && (
                          <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5"></div>
                            <div className="flex-1">
                              <p className="text-xs text-gray-500">Order Created</p>
                              <p className="text-sm font-medium text-gray-900">
                                {new Date(trackedOrder.createdAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        )}
                        {/* Travel log will be added here in future update */}
                        <div className="text-xs text-gray-500 italic pl-5">
                          Travel log updates coming soon...
                        </div>
                      </div>
                    </div>
                  </div>
                    );
                  })()
                ) : (
                  // Empty state when no order is tracked yet
                  !trackingLoading && !trackingError && (
                    <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
                      <div className="text-5xl mb-3">📦</div>
                      <p className="text-gray-700 font-medium">Enter an Order ID or tracking number to track</p>
                      <p className="text-sm text-gray-500 mt-1">Package details will appear here</p>
                    </div>
                  )
                )}

                {/* Reports Section (if any) */}
                {reports.length > 0 && (
                  <div className="mt-8 pt-6 border-t-2 border-gray-200">
                    <h4 className="font-bold text-gray-900 mb-4">Additional Reports</h4>
                    {reports.map((report) => (
                    <div
                      key={report.id}
                      className="bg-white rounded-xl shadow-sm p-5 border-2 border-gray-100 hover:border-red-200 hover:shadow-lg transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 text-lg mb-1">{report.title}</h4>
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <span>📅</span>
                            {new Date(report.date).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1.5 text-xs font-bold rounded-full shadow-sm ${getReportStatusColor(report.status)}`}
                        >
                          {report.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="pt-3 border-t border-gray-100">
                        <span className="text-xs font-medium text-gray-600 capitalize bg-gray-50 px-3 py-1 rounded-full">
                          {report.type}
                        </span>
                      </div>
                    </div>
                  ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="px-6 py-4 border-t-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
              <span className="text-gray-900 font-bold text-lg">{counts.total}</span>
              <span className="text-gray-600 text-sm">Total Points</span>
            </div>
            <div className="flex items-center gap-2 bg-red-50 px-4 py-2 rounded-lg border border-red-100">
              <span className="text-red-600 font-bold text-lg">{counts.active}</span>
              <span className="text-gray-600 text-sm">Active</span>
            </div>
            <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-100">
              <span className="text-yellow-600 font-bold text-lg">{counts.pending}</span>
              <span className="text-gray-600 text-sm">Pending</span>
            </div>
            <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg border border-green-100">
              <span className="text-green-600 font-bold text-lg">{counts.completed}</span>
              <span className="text-gray-600 text-sm">Completed</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
              <span className="text-blue-600 font-bold text-lg">{counts.airports}</span>
              <span className="text-gray-600 text-sm">Airports</span>
            </div>
            <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
              <span className="text-green-600 font-bold text-lg">{counts.seaports}</span>
              <span className="text-gray-600 text-sm">Seaports</span>
            </div>
            <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-200">
              <span className="text-yellow-600 font-bold text-lg">{counts.storage}</span>
              <span className="text-gray-600 text-sm">Storage</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
              <span className="text-gray-900 font-bold text-lg">{reports.length}</span>
              <span className="text-gray-600 text-sm">Reports</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
