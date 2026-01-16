import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { locationsAPI } from '../services/api';

const Locations = () => {
  const { user } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [map, setMap] = useState(null);
  const [mapInitialized, setMapInitialized] = useState(false);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const [formData, setFormData] = useState({
    name: '',
    type: 'storage',
    latitude: '',
    longitude: '',
    address: '',
    city: '',
    country: '',
    description: ''
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (locations.length > 0 && !mapInitialized) {
      initializeMap();
    }
  }, [locations, mapInitialized]);

  useEffect(() => {
    if (map && locations.length > 0) {
      updateMarkers();
    }
  }, [locations, map]);

  const fetchLocations = async () => {
    try {
      const response = await locationsAPI.getAll();
      setLocations(response.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching locations:', error);
      setLoading(false);
    }
  };

  const initializeMap = () => {
    // Check if Leaflet is available
    if (typeof window !== 'undefined' && window.L) {
      const L = window.L;
      
      // Initialize map - center on locations if available, otherwise default
      let defaultLat = 20.5937;
      let defaultLng = 78.9629;
      let defaultZoom = 3;
      
      if (locations.length > 0) {
        // Center on first location or calculate center of all locations
        defaultLat = locations[0].latitude;
        defaultLng = locations[0].longitude;
        defaultZoom = 2; // Start with world view to see all airports
      }
      
      const mapInstance = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        dragging: true
      }).setView([defaultLat, defaultLng], defaultZoom);

      // Add OpenStreetMap tiles with 2D style
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        minZoom: 2,
        maxZoom: 19,
        zoomControl: true
      }).addTo(mapInstance);

      // Ensure zoom controls are visible
      mapInstance.zoomControl.setPosition('topright');

      setMap(mapInstance);
      setMapInitialized(true);
    } else {
      // Fallback: Load Leaflet dynamically
      loadLeaflet();
    }
  };

  const loadLeaflet = () => {
    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = () => {
      initializeMap();
    };
    document.body.appendChild(script);
  };

  const updateMarkers = () => {
    if (!map || !window.L) return;

    const L = window.L;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add markers for each location
    locations.forEach(location => {
      const iconColor = getIconColor(location.type);
      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color: ${iconColor}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const marker = L.marker([location.latitude, location.longitude], { icon: customIcon })
        .addTo(map)
        .bindPopup(`
          <div class="p-2">
            <h3 class="font-bold text-sm">${location.name}</h3>
            <p class="text-xs text-gray-600">${location.type.toUpperCase()}</p>
            ${location.address ? `<p class="text-xs text-gray-500">${location.address}</p>` : ''}
          </div>
        `);

      markersRef.current.push(marker);
    });

    // Fit map to show all markers with appropriate zoom
    if (locations.length > 0) {
      const bounds = L.latLngBounds(locations.map(loc => [loc.latitude, loc.longitude]));
      // For many airports, use world view; for fewer, fit bounds
      if (locations.length > 20) {
        // World view for many airports
        map.setView([20, 0], 2);
      } else if (locations.length === 1) {
        // Single location - zoom in
        map.setView([locations[0].latitude, locations[0].longitude], 10);
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleMapClick = (e) => {
    if (showForm && e.latlng) {
      setFormData(prev => ({
        ...prev,
        latitude: e.latlng.lat.toFixed(6),
        longitude: e.latlng.lng.toFixed(6)
      }));
    }
  };

  useEffect(() => {
    if (map) {
      if (showForm) {
        map.on('click', handleMapClick);
        map.dragging.enable();
      } else {
        map.off('click', handleMapClick);
      }
    }
    return () => {
      if (map) {
        map.off('click', handleMapClick);
      }
    };
  }, [map, showForm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingLocation) {
        await locationsAPI.update(editingLocation.id, formData);
      } else {
        await locationsAPI.create(formData);
      }
      
      setShowForm(false);
      setEditingLocation(null);
      setFormData({
        name: '',
        type: 'storage',
        latitude: '',
        longitude: '',
        address: '',
        city: '',
        country: '',
        description: ''
      });
      fetchLocations();
    } catch (error) {
      console.error('Error saving location:', error);
      alert(error.response?.data?.message || 'Failed to save location');
    }
  };

  const handleEdit = (location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      type: location.type,
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      address: location.address || '',
      city: location.city || '',
      country: location.country || '',
      description: location.description || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this location?')) {
      return;
    }
    
    try {
      await locationsAPI.delete(id);
      fetchLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('Failed to delete location');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingLocation(null);
    setFormData({
      name: '',
      type: 'storage',
      latitude: '',
      longitude: '',
      address: '',
      city: '',
      country: '',
      description: ''
    });
  };

  const filteredLocations = {
    storage: locations.filter(loc => loc.type === 'storage'),
    airport: locations.filter(loc => loc.type === 'airport'),
    seaport: locations.filter(loc => loc.type === 'seaport')
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-black">Locations Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition font-semibold"
        >
          {showForm ? 'Cancel' : '+ Add Location'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Section - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-xl font-bold mb-4 text-black">Map View</h2>
            {showForm && (
              <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-600 rounded">
                <p className="text-sm text-black font-semibold">
                  Click on the map to set coordinates for the new location
                </p>
              </div>
            )}
            <div 
              ref={mapRef} 
              className="w-full h-96 rounded-lg border-2 border-gray-300"
              style={{ zIndex: 1 }}
            />
          </div>
        </div>

        {/* Locations List and Form */}
        <div className="space-y-6">
          {/* Add/Edit Form */}
          {showForm && (
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-600">
              <h2 className="text-xl font-bold mb-4 text-black">
                {editingLocation ? 'Edit Location' : 'Add New Location'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Type <span className="text-red-600">*</span>
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                  >
                    <option value="storage">Storage</option>
                    <option value="airport">Airport</option>
                    <option value="seaport">Seaport</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Latitude <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Longitude <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-1">Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">City</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">Country</label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-1">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition font-semibold"
                  >
                    {editingLocation ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition font-semibold text-black"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Locations List */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 text-black">All Locations</h2>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600"></div>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {/* Storage Locations */}
                {filteredLocations.storage.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-red-600 mb-2">Storage ({filteredLocations.storage.length})</h3>
                    {filteredLocations.storage.map(loc => (
                      <LocationCard key={loc.id} location={loc} onEdit={handleEdit} onDelete={handleDelete} />
                    ))}
                  </div>
                )}

                {/* Airport Locations */}
                {filteredLocations.airport.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-blue-600 mb-2">Airports ({filteredLocations.airport.length})</h3>
                    {filteredLocations.airport.map(loc => (
                      <LocationCard key={loc.id} location={loc} onEdit={handleEdit} onDelete={handleDelete} />
                    ))}
                  </div>
                )}

                {/* Seaport Locations */}
                {filteredLocations.seaport.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-green-600 mb-2">Seaports ({filteredLocations.seaport.length})</h3>
                    {filteredLocations.seaport.map(loc => (
                      <LocationCard key={loc.id} location={loc} onEdit={handleEdit} onDelete={handleDelete} />
                    ))}
                  </div>
                )}

                {locations.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No locations added yet</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const LocationCard = ({ location, onEdit, onDelete }) => {
  const getTypeColor = (type) => {
    const colors = {
      storage: 'bg-red-100 text-red-800',
      airport: 'bg-blue-100 text-blue-800',
      seaport: 'bg-green-100 text-green-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:border-red-300 transition">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-semibold text-black">{location.name}</h4>
          <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(location.type)}`}>
            {location.type}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(location)}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(location.id)}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            Delete
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-600">
        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
      </p>
      {location.address && (
        <p className="text-xs text-gray-500 mt-1">{location.address}</p>
      )}
    </div>
  );
};

export default Locations;
