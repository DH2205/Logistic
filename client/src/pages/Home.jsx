import { Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { productsAPI, locationsAPI } from '../services/api';

const Home = () => {
  const [shipments, setShipments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [mapView, setMapView] = useState('all'); // 'all', 'storage', 'airport', 'seaport'
  const [stats, setStats] = useState({
    active: 0,
    inTransit: 0,
    delivered: 0,
    totalValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    fetchShipments();
    fetchLocations();
    
    // Try to initialize map after a delay to ensure DOM is ready
    const initTimer = setTimeout(() => {
      if (mapRef.current && !mapInstanceRef.current) {
        if (typeof window !== 'undefined' && window.L) {
          console.log('Leaflet already loaded, initializing map...');
          initializeMap();
        } else {
          console.log('Loading Leaflet library...');
          loadLeaflet();
        }
      }
    }, 500);
    
    // Simulate real-time updates
    const interval = setInterval(() => {
      fetchShipments();
    }, 30000); // Update every 30 seconds
    
    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
      // Cleanup map
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Error cleaning up map:', e);
        }
        mapInstanceRef.current = null;
      }
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    // Wait a bit for DOM to be ready
    const timer = setTimeout(() => {
      if (!mapInstanceRef.current && mapRef.current) {
        // Check if Leaflet is loaded, if not, load it first
        if (typeof window !== 'undefined' && window.L) {
          initializeMap();
        } else {
          loadLeaflet();
        }
      } else if (mapInstanceRef.current && locations.length > 0) {
        updateMarkers();
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [locations, mapView]);

  const fetchShipments = async () => {
    try {
      const response = await productsAPI.getAll({});
      const data = response.data.slice(0, 8);
      setShipments(data);
      
      // Calculate stats
      setStats({
        active: Math.floor(Math.random() * 50) + 20,
        inTransit: Math.floor(Math.random() * 30) + 15,
        delivered: Math.floor(Math.random() * 200) + 150,
        totalValue: Math.floor(Math.random() * 500000) + 250000,
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching shipments:', error);
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await locationsAPI.getAll();
      const fetchedLocations = response.data || [];
      setLocations(fetchedLocations);
      setMapLoading(false);
      
      // Always try to initialize map after locations are loaded
      setTimeout(() => {
        if (!mapInstanceRef.current && mapRef.current) {
          if (typeof window !== 'undefined' && window.L) {
            initializeMap();
          } else {
            loadLeaflet();
          }
        } else if (mapInstanceRef.current && fetchedLocations.length > 0) {
          updateMarkers();
        }
      }, 300);
    } catch (error) {
      console.error('Error fetching locations:', error);
      setMapLoading(false);
    }
  };

  const initializeMap = () => {
    if (!mapRef.current) {
      console.error('Map container not found');
      return;
    }

    if (typeof window === 'undefined' || !window.L) {
      console.log('Leaflet not available, loading...');
      loadLeaflet();
      return;
    }

    const L = window.L;
    
    // Destroy existing map if any
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (e) {
        console.warn('Error removing existing map:', e);
      }
      mapInstanceRef.current = null;
    }
    
    console.log('Initializing map on container:', mapRef.current);
    
    // Default center - start with world view to see all airports
    const defaultLat = 20.5937; // World center
    const defaultLng = 0; // Prime meridian
    const defaultZoom = 2; // World view
    
    try {
      // Ensure container has proper dimensions
      const container = mapRef.current;
      if (container) {
        container.style.height = '100%';
        container.style.width = '100%';
        container.style.minHeight = '500px';
      }
      
      const mapInstance = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        dragging: true,
        minZoom: 2,
        maxZoom: 19,
        preferCanvas: false
      }).setView([defaultLat, defaultLng], defaultZoom);
      
      // Force immediate size calculation
      setTimeout(() => {
        mapInstance.invalidateSize(false);
      }, 50);

      console.log('Map instance created');

      // Add OpenStreetMap tiles with 2D style
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        minZoom: 2,
        maxZoom: 19,
        noWrap: false,
        crossOrigin: true,
        errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      }).addTo(mapInstance);
      
      // Handle tile errors
      tileLayer.on('tileerror', (error, tile) => {
        console.warn('Tile loading error:', error, tile);
      });

      console.log('Tile layer added');

      // Ensure zoom controls are visible
      if (mapInstance.zoomControl) {
        mapInstance.zoomControl.setPosition('topright');
      }

      mapInstanceRef.current = mapInstance;
      
      // Wait for tiles to load and then invalidate size
      tileLayer.on('load', () => {
        console.log('Map tiles loaded');
        mapInstance.invalidateSize();
      });
      
      // Invalidate size multiple times to ensure proper rendering
      setTimeout(() => {
        try {
          mapInstance.invalidateSize();
          console.log('Map size invalidated (first time)');
        } catch (error) {
          console.error('Error invalidating map size:', error);
        }
      }, 100);
      
      setTimeout(() => {
        try {
          mapInstance.invalidateSize();
          console.log('Map size invalidated (second time), updating markers...');
          updateMarkers();
        } catch (error) {
          console.error('Error invalidating map size:', error);
        }
      }, 500);
      
      // One more invalidation after a longer delay
      setTimeout(() => {
        try {
          mapInstance.invalidateSize();
          console.log('Map size invalidated (final)');
        } catch (error) {
          console.error('Error invalidating map size:', error);
        }
      }, 1000);
    } catch (error) {
      console.error('Error initializing map:', error);
      setMapLoading(false);
    }
  };

  const loadLeaflet = () => {
    // Check if already loading
    if (document.querySelector('script[src*="leaflet"]')) {
      // Script already loading, just wait for it
      const checkLeaflet = setInterval(() => {
        if (window.L && mapRef.current) {
          clearInterval(checkLeaflet);
          setTimeout(() => {
            if (mapRef.current) {
              initializeMap();
            }
          }, 300);
        }
      }, 100);
      
      // Timeout after 10 seconds
      setTimeout(() => clearInterval(checkLeaflet), 10000);
      return;
    }

    console.log('Loading Leaflet library...');

    // Check if CSS already loaded
    if (!document.querySelector('link[href*="leaflet"]')) {
      // Load Leaflet CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
      console.log('Leaflet CSS loaded');
    }

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = () => {
      console.log('Leaflet JS loaded, initializing map...');
      // Wait a bit for map container to be ready
      setTimeout(() => {
        if (mapRef.current && window.L) {
          console.log('Map container found, initializing...');
          initializeMap();
        } else {
          console.error('Map container or Leaflet not available:', {
            hasContainer: !!mapRef.current,
            hasLeaflet: !!window.L
          });
        }
      }, 300);
    };
    script.onerror = (error) => {
      console.error('Failed to load Leaflet library:', error);
      setMapLoading(false);
    };
    document.body.appendChild(script);
  };

  const updateMarkers = () => {
    if (!mapInstanceRef.current || !window.L || !locations.length) {
      console.log('Cannot update markers:', {
        hasMap: !!mapInstanceRef.current,
        hasLeaflet: !!window.L,
        hasLocations: locations.length > 0
      });
      return;
    }

    const L = window.L;
    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      try {
        marker.remove();
      } catch (e) {
        console.error('Error removing marker:', e);
      }
    });
    markersRef.current = [];

    // Filter locations based on view
    const filteredLocations = mapView === 'all' 
      ? locations 
      : locations.filter(loc => loc.type === mapView);

    if (filteredLocations.length === 0) {
      console.log('No locations to display for view:', mapView);
      return;
    }

    console.log(`Adding ${filteredLocations.length} markers to map`);

    // Add markers for each location
    filteredLocations.forEach(location => {
      try {
        const iconColor = getIconColor(location.type);
        const customIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="background-color: ${iconColor}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4); cursor: pointer;"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker([location.latitude, location.longitude], { icon: customIcon })
          .addTo(map)
          .bindPopup(`
            <div class="p-2">
              <h3 class="font-bold text-sm text-black">${location.name}</h3>
              <p class="text-xs font-semibold" style="color: ${iconColor}">${location.type.toUpperCase()}</p>
              ${location.address ? `<p class="text-xs text-gray-600 mt-1">${location.address}</p>` : ''}
              ${location.city && location.country ? `<p class="text-xs text-gray-500">${location.city}, ${location.country}</p>` : ''}
            </div>
          `);

        markersRef.current.push(marker);
      } catch (error) {
        console.error('Error adding marker for location:', location.name, error);
      }
    });

    // Fit map to show all markers with appropriate zoom
    if (filteredLocations.length > 0) {
      const bounds = L.latLngBounds(filteredLocations.map(loc => [loc.latitude, loc.longitude]));
      // For many airports, use world view; for fewer, fit bounds
      if (filteredLocations.length > 10) {
        // World view for many airports
        map.setView([20, 0], 2);
      } else if (filteredLocations.length === 1) {
        // Single location - zoom in
        map.setView([filteredLocations[0].latitude, filteredLocations[0].longitude], 10);
      } else {
        // Fit bounds for moderate number of locations
        map.fitBounds(bounds, { 
          padding: [50, 50],
          maxZoom: 12
        });
      }
    }
  };

  const getIconColor = (type) => {
    const colors = {
      storage: '#dc2626', // red
      airport: '#3b82f6', // blue
      seaport: '#10b981' // green
    };
    return colors[type] || '#6b7280';
  };

  const getLocationStats = () => {
    return {
      storage: locations.filter(loc => loc.type === 'storage').length,
      airport: locations.filter(loc => loc.type === 'airport').length,
      seaport: locations.filter(loc => loc.type === 'seaport').length,
      total: locations.length
    };
  };

  // Generate chart data
  const chartData = [65, 78, 82, 75, 88, 92, 85];
  const maxChartValue = Math.max(...chartData);

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header Section */}
      <section className="bg-gradient-to-r from-red-600 to-red-800 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Logistics Optimization Dashboard</h1>
              <p className="text-red-100 text-lg">
                Real-time shipment tracking and route optimization
              </p>
            </div>
            <Link
              to="/orders/create"
              className="bg-white text-red-600 px-6 py-3 rounded-lg font-semibold hover:bg-red-50 transition shadow-lg"
            >
              Create Order
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Active Orders</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.active}</p>
                <p className="text-green-600 text-sm mt-1">↑ 12% from last week</p>
              </div>
              <div className="text-4xl">📦</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">In Transit</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.inTransit}</p>
                <p className="text-red-600 text-sm mt-1">Real-time tracking</p>
              </div>
              <div className="text-4xl">🚚</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Delivered (MTD)</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.delivered}</p>
                <p className="text-green-600 text-sm mt-1">↑ 8% from last month</p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-600">
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

      {/* Main Dashboard Grid */}
      <section className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Section - Takes 2 columns */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6 border-l-4 border-red-600">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-black">Locations Map</h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setMapView('all')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    mapView === 'all' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button 
                  onClick={() => setMapView('storage')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    mapView === 'storage' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Storage
                </button>
                <button 
                  onClick={() => setMapView('airport')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    mapView === 'airport' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Airports
                </button>
                <button 
                  onClick={() => setMapView('seaport')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    mapView === 'seaport' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Seaports
                </button>
                <Link
                  to="/locations"
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition"
                >
                  Manage
                </Link>
              </div>
            </div>
            {/* Real Map */}
            {mapLoading ? (
              <div className="bg-gray-100 rounded-lg flex items-center justify-center border-2 border-gray-200" style={{ minHeight: '500px', height: '500px' }}>
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mb-4"></div>
                  <p className="text-gray-600">Loading map...</p>
                </div>
              </div>
            ) : (
              <div className="relative w-full" style={{ height: '500px' }}>
                <div 
                  ref={mapRef} 
                  id="map-container"
                  className="w-full h-full rounded-lg border-2 border-gray-300"
                  style={{ 
                    zIndex: 1, 
                    position: 'relative',
                    minHeight: '500px',
                    height: '100%'
                  }}
                />
                {/* Map overlay info - Fixed positioning */}
                <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border-l-4 border-red-600 z-10 pointer-events-auto">
                  <p className="text-sm font-semibold text-black">
                    {getLocationStats().total} Total Locations
                  </p>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="text-red-600 font-semibold">
                      {getLocationStats().storage} Storage
                    </span>
                    <span className="text-blue-600 font-semibold">
                      {getLocationStats().airport} Airports
                    </span>
                    <span className="text-green-600 font-semibold">
                      {getLocationStats().seaport} Seaports
                    </span>
                  </div>
                </div>
                {!mapInstanceRef.current && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50/90 rounded-lg z-20">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600 mb-2"></div>
                      <p className="text-gray-600 font-semibold mb-2">Initializing map...</p>
                      <p className="text-xs text-gray-500">Using OpenStreetMap (no API key required)</p>
                    </div>
                  </div>
                )}
                {locations.length === 0 && mapInstanceRef.current && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 rounded-lg z-20 pointer-events-none">
                    <div className="text-center bg-white/90 p-4 rounded-lg">
                      <p className="text-gray-600 font-semibold mb-2">No locations added yet</p>
                      <Link
                        to="/locations"
                        className="text-red-600 hover:text-red-700 font-medium underline pointer-events-auto"
                      >
                        Add your first location →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Performance Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Weekly Performance</h2>
            <div className="h-64 flex items-end justify-between gap-2">
              {chartData.map((value, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-gradient-to-t from-red-600 to-red-500 rounded-t-lg transition-all hover:from-red-700 hover:to-red-600"
                    style={{ height: `${(value / maxChartValue) * 100}%` }}
                    title={`${value}%`}
                  />
                  <span className="text-xs text-gray-500 mt-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Avg. Efficiency</span>
                <span className="font-semibold text-gray-900">81%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Orders and Locations Section */}
      <section className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Shipments/Orders Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Recent Orders</h2>
              <Link
                to="/orders"
                className="text-red-600 hover:text-red-700 font-medium text-sm"
              >
                View All →
              </Link>
            </div>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shipment ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Origin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Destination
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ETA
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shipments.slice(0, 6).map((shipment, index) => {
                    const statuses = ['In Transit', 'At Warehouse', 'Out for Delivery', 'Delivered'];
                    const status = statuses[index % statuses.length];
                    const statusColors = {
                      'In Transit': 'bg-yellow-100 text-yellow-800',
                      'At Warehouse': 'bg-blue-100 text-blue-800',
                      'Out for Delivery': 'bg-purple-100 text-purple-800',
                      'Delivered': 'bg-green-100 text-green-800',
                    };
                    return (
                      <tr key={shipment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            #{shipment.id.toString().padStart(6, '0')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia'][index % 6]}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {['Miami', 'Seattle', 'Boston', 'Denver', 'Atlanta', 'Portland'][index % 6]}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[status]}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {index % 2 === 0 ? '2 days' : '5 days'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ${(shipment.price * 100).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>

          {/* Locations Management Section */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden border-l-4 border-red-600">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Locations Management</h2>
              <Link
                to="/locations"
                className="text-red-600 hover:text-red-700 font-medium text-sm"
              >
                Manage →
              </Link>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Manage storage facilities, airports, and seaports. Add and view locations on the map.
              </p>
              
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="w-3 h-3 rounded-full bg-red-600"></div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-black">Storage Facilities</p>
                    <p className="text-xs text-gray-600">Warehouses and storage locations</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-black">Airports</p>
                    <p className="text-xs text-gray-600">Air freight terminals</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="w-3 h-3 rounded-full bg-green-600"></div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-black">Seaports</p>
                    <p className="text-xs text-gray-600">Maritime shipping ports</p>
                  </div>
                </div>
              </div>

              <Link
                to="/locations"
                className="block w-full bg-red-600 text-white text-center px-6 py-3 rounded-lg hover:bg-red-700 transition font-semibold"
              >
                Open Locations Manager
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/shipments"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition border-2 border-transparent hover:border-blue-500"
          >
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 rounded-lg p-3">
                <span className="text-2xl">🚀</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Start Optimizing</h3>
                <p className="text-sm text-gray-600">Create new shipment route</p>
              </div>
            </div>
          </Link>
          <Link
            to="/locations"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition border-2 border-transparent hover:border-red-500"
          >
            <div className="flex items-center gap-4">
              <div className="bg-red-100 rounded-lg p-3">
                <span className="text-2xl">📍</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Manage Locations</h3>
                <p className="text-sm text-gray-600">Storage, airports & seaports</p>
              </div>
            </div>
          </Link>
          <Link
            to="/orders"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition border-2 border-transparent hover:border-purple-500"
          >
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 rounded-lg p-3">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">View Analytics</h3>
                <p className="text-sm text-gray-600">Track performance metrics</p>
              </div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
