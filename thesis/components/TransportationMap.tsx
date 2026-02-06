'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { locationsAPI } from '@/lib/api';

// Custom icon for transportation routes - will be created when L is available
const createTransportIcon = (color: string, L: any) => {
  if (!L || typeof window === 'undefined') return null;
  return L.divIcon({
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
};

interface TransportPoint {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  type: 'origin' | 'destination' | 'waypoint';
  status?: 'active' | 'completed' | 'pending';
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
  activeRoutes?: TransportPoint[];
  completedRoutes?: TransportPoint[];
  pendingRoutes?: TransportPoint[];
  ports?: Port[];
  reports?: Report[];
  showControls?: boolean;
}

// Component to handle map bounds - must be inside MapContainer
// Dynamically imported to avoid SSR issues
const MapBoundsUpdater = dynamic(
  () => import('react-leaflet').then((mod) => {
    function MapBoundsUpdaterComponent({ mapRef, points }: { 
      mapRef: React.MutableRefObject<any | null>, 
      points: TransportPoint[] 
    }) {
      const map = mod.useMap();
      
      useEffect(() => {
        if (map) {
          mapRef.current = map;
          
          // Wait for map to be ready before updating bounds
          const updateBounds = async () => {
            try {
              // Dynamically import Leaflet inside the effect
              const L = await import('leaflet');
              if (points.length > 0) {
                const bounds = L.default.latLngBounds(
                  points.map(p => [p.latitude, p.longitude] as [number, number])
                );
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
              } else {
                map.setView([20, 0], 2);
              }
            } catch (error) {
              // Map might not be ready yet
            }
          };
          
          if (map.getContainer()) {
            updateBounds();
          } else {
            map.whenReady(updateBounds);
          }
        }
      }, [map]);
      
      useEffect(() => {
        if (map && map.getContainer()) {
          import('leaflet').then((L) => {
            try {
              if (points.length > 0) {
                const bounds = L.default.latLngBounds(
                  points.map(p => [p.latitude, p.longitude] as [number, number])
                );
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
              }
            } catch (error) {
              // Ignore errors
            }
          });
        }
      }, [points.length, map]);
      
      return null;
    }
    return MapBoundsUpdaterComponent;
  }),
  { ssr: false }
);

// Dynamically import map components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

export default function TransportationMap({
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
  const [selectedTab, setSelectedTab] = useState<'ports' | 'reports'>('ports');
  const [ports, setPorts] = useState<Port[]>(initialPorts);
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [selectedPortType, setSelectedPortType] = useState<'all' | 'airport' | 'seaport' | 'storage'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const mapRef = useRef<any>(null);
  const [leafletLib, setLeafletLib] = useState<any>(null);
  
  // Order tracking states
  const [trackingOrderId, setTrackingOrderId] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<any | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  
  // Use refs to track fetch status - these persist across renders and prevent re-fetching
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);

  // Load Leaflet only on client side
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && !leafletLib) {
      import('leaflet').then((L) => {
        setLeafletLib(L.default);
        // Fix for default marker icons
        const iconRetinaUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png';
        const iconUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png';
        const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';
        
        delete (L.default.Icon.Default.prototype as any)._getIconUrl;
        L.default.Icon.Default.mergeOptions({
          iconRetinaUrl,
          iconUrl,
          shadowUrl,
        });
      });
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

  // Function to track order by ID
  const handleTrackOrder = async () => {
    if (!trackingOrderId.trim()) {
      setTrackingError('Please enter an order ID');
      return;
    }

    setTrackingLoading(true);
    setTrackingError(null);
    setTrackedOrder(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setTrackingError('Please login to track orders');
        setTrackingLoading(false);
        return;
      }

      console.log('📦 Tracking order:', trackingOrderId);
      const response = await fetch(`/api/orders/${trackingOrderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Order not found. Please check the Order ID.');
        }
        throw new Error('Failed to fetch order details');
      }

      const orderData = await response.json();
      console.log('✅ Order tracked successfully:', orderData);
      setTrackedOrder(orderData);
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

  const getIcon = useMemo(() => {
    return (point: TransportPoint, isPort: boolean = false) => {
      if (!leafletLib) return null;
      
      if (isPort) {
        // Different colors for different port types
        if (point.type === 'waypoint') {
          return createTransportIcon('#3b82f6', leafletLib); // Blue for airports
        } else if (point.type === 'destination') {
          return createTransportIcon('#10b981', leafletLib); // Green for seaports
        } else {
          return createTransportIcon('#f59e0b', leafletLib); // Yellow for storage
        }
      }
      
      if (point.status === 'active') {
        return createTransportIcon('#ef4444', leafletLib); // Red for active
      } else if (point.status === 'completed') {
        return createTransportIcon('#10b981', leafletLib); // Green for completed
      } else if (point.status === 'pending') {
        return createTransportIcon('#f59e0b', leafletLib); // Yellow for pending
      }
      return createTransportIcon('#3b82f6', leafletLib); // Blue default
    };
  }, [leafletLib]);

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
          <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-3 border border-gray-200">
            <h4 className="text-xs font-bold text-gray-700 mb-2">Map Legend</h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div>
                <span className="text-xs text-gray-600">Airports</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm"></div>
                <span className="text-xs text-gray-600">Seaports</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-yellow-500 border-2 border-white shadow-sm"></div>
                <span className="text-xs text-gray-600">Storage</span>
              </div>
              {filteredPoints.length > 0 && (
                <>
                  <div className="border-t border-gray-200 my-1.5"></div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-sm"></div>
                    <span className="text-xs text-gray-600">Active Routes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-yellow-500 border-2 border-white shadow-sm"></div>
                    <span className="text-xs text-gray-600">Pending</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm"></div>
                    <span className="text-xs text-gray-600">Completed</span>
                  </div>
                </>
              )}
            </div>
          </div>
          
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
            {mounted && <MapBoundsUpdater mapRef={mapRef} points={[...filteredPoints, ...portMarkers]} />}
            
            {/* Display port markers */}
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
                      Type: <span className="capitalize font-medium">{point.type === 'waypoint' ? 'Airport' : point.type === 'destination' ? 'Seaport' : 'Storage'}</span>
                    </p>
                    {ports.find(p => p.id === point.id)?.description && (
                      <p className="text-xs text-gray-500 mb-2">
                        {ports.find(p => p.id === point.id)?.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
            
            {/* Display route points */}
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
                        Status: <span className="capitalize font-medium">{point.status}</span>
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
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
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedTab === 'ports' ? (
              <div className="space-y-4">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">Ports & Facilities</h3>
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
                  <p className="text-sm text-gray-500 mb-4">Enter your Order ID to track package progress</p>
                  
                  {/* Order ID Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter Order ID (e.g., ORD-ABC123...)"
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
                      {trackingLoading ? '🔄 Tracking...' : '🔍 Track'}
                    </button>
                  </div>

                  {/* Error Message */}
                  {trackingError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      ⚠️ {trackingError}
                    </div>
                  )}
                </div>

                {/* Tracked Order Details */}
                {trackedOrder ? (
                  <div className="space-y-3">
                    {/* Compact Header with Order ID and Status */}
                    <div className="bg-white border-l-4 border-red-600 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Order ID</p>
                          <p className="font-bold text-gray-900 text-lg">{trackedOrder.orderId}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          trackedOrder.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          trackedOrder.status === 'in_transit' ? 'bg-blue-100 text-blue-700' :
                          trackedOrder.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {trackedOrder.status?.toUpperCase().replace('_', ' ') || 'PENDING'}
                        </span>
                      </div>
                    </div>

                    {/* Tracking Information */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                      <h6 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
                        🗺️ Tracking Information
                      </h6>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Tracking Number</p>
                          <p className="font-semibold text-gray-900 text-sm">TRK{trackedOrder.orderId?.substring(4) || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Status</p>
                          <p className="font-semibold text-gray-900 text-sm capitalize">{trackedOrder.status?.replace('_', ' ') || 'Pending'}</p>
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
                            <p className="font-semibold text-gray-900 text-sm">{trackedOrder.origin?.country || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="text-gray-400 text-xl">→</div>
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          <div>
                            <p className="text-xs text-gray-500 text-right">Destination</p>
                            <p className="font-semibold text-gray-900 text-sm text-right">{trackedOrder.destination?.country || 'N/A'}</p>
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

                    {/* Current Location - Placeholder for future update */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h6 className="font-bold text-gray-900 mb-2 text-sm flex items-center gap-2">
                        📍 Current Location
                      </h6>
                      <p className="text-sm text-gray-600">
                        {trackedOrder.status === 'delivered' 
                          ? `Delivered at ${trackedOrder.destination?.country || 'destination'}`
                          : trackedOrder.status === 'in_transit'
                          ? 'In transit - Location tracking will be updated'
                          : `Pending at ${trackedOrder.origin?.country || 'origin'}`
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
                ) : (
                  // Empty state when no order is tracked yet
                  !trackingLoading && !trackingError && (
                    <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
                      <div className="text-5xl mb-3">📦</div>
                      <p className="text-gray-700 font-medium">Enter an Order ID to track</p>
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
