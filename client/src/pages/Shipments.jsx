import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { productsAPI } from '../services/api';

const Shipments = () => {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    freightType: '',
    origin: '',
    destination: '',
    sort: '',
  });

  useEffect(() => {
    fetchShipments();
  }, [filters]);

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.freightType) params.freightType = filters.freightType;
      if (filters.origin) params.origin = filters.origin;
      if (filters.destination) params.destination = filters.destination;
      if (filters.sort) params.sort = filters.sort;

      const response = await productsAPI.getAll(params);
      // Transform product data to shipment format for display
      const shipmentData = response.data.map((item, index) => ({
        id: item.id,
        orderID: `ORD-${String(item.id).padStart(6, '0')}`,
        customerName: `Customer ${index + 1}`,
        customerEmail: `customer${index + 1}@example.com`,
        goodsDescription: item.name,
        origin: ['New York, USA', 'Los Angeles, USA', 'Chicago, USA', 'Houston, USA'][index % 4] || 'New York, USA',
        destination: ['London, UK', 'Tokyo, Japan', 'Sydney, Australia', 'Frankfurt, Germany'][index % 4] || 'London, UK',
        freightType: ['air', 'sea', 'land'][index % 3],
        status: ['In Transit', 'At Warehouse', 'Out for Delivery', 'Delivered'][index % 4],
        trackingProgress: Math.min(100, (index % 4) * 25 + 25),
        weight: `${(Math.random() * 1000 + 100).toFixed(1)} kg`,
        volume: `${(Math.random() * 10 + 1).toFixed(2)} m³`,
        estimatedCost: `$${(item.price * 100).toLocaleString()}`,
        createdAt: new Date(Date.now() - index * 86400000).toLocaleDateString(),
      }));
      setShipments(shipmentData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching shipments:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'In Transit': 'bg-yellow-100 text-yellow-800',
      'At Warehouse': 'bg-blue-100 text-blue-800',
      'Out for Delivery': 'bg-purple-100 text-purple-800',
      'Delivered': 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getFreightTypeIcon = (type) => {
    const icons = {
      air: '✈️',
      sea: '🚢',
      land: '🚛',
    };
    return icons[type] || '📦';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Shipments</h1>
        <Link
          to="/shipments/new"
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition"
        >
          Create New Shipment
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              placeholder="Order ID, Customer..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Status</option>
              <option value="In Transit">In Transit</option>
              <option value="At Warehouse">At Warehouse</option>
              <option value="Out for Delivery">Out for Delivery</option>
              <option value="Delivered">Delivered</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Freight Type
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500"
              value={filters.freightType}
              onChange={(e) => setFilters({ ...filters, freightType: e.target.value })}
            >
              <option value="">All Types</option>
              <option value="air">Air Freight</option>
              <option value="sea">Sea Freight</option>
              <option value="land">Land Freight</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Origin
            </label>
            <input
              type="text"
              placeholder="Origin city"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500"
              value={filters.origin}
              onChange={(e) => setFilters({ ...filters, origin: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Destination
            </label>
            <input
              type="text"
              placeholder="Destination city"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500"
              value={filters.destination}
              onChange={(e) => setFilters({ ...filters, destination: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500"
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            >
              <option value="">Default</option>
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="status">By Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* Shipments Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
        </div>
      ) : shipments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-600 text-xl">No shipments found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Goods Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Freight Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tracking Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {shipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {shipment.orderID}
                      </div>
                      <div className="text-xs text-gray-500">{shipment.createdAt}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {shipment.customerName}
                      </div>
                      <div className="text-xs text-gray-500">{shipment.customerEmail}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{shipment.goodsDescription}</div>
                      <div className="text-xs text-gray-500">
                        {shipment.weight} • {shipment.volume}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <span className="font-medium">{shipment.origin}</span>
                        <span className="mx-2">→</span>
                        <span className="font-medium">{shipment.destination}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-lg">{getFreightTypeIcon(shipment.freightType)}</span>
                      <span className="ml-2 text-sm text-gray-900 capitalize">
                        {shipment.freightType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(shipment.status)}`}>
                        {shipment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${shipment.trackingProgress}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600">{shipment.trackingProgress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        to={`/shipments/${shipment.id}`}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shipments;
