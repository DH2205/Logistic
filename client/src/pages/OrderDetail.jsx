import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ordersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchOrder();
  }, [id, user]);

  const fetchOrder = async () => {
    try {
      const response = await ordersAPI.getById(id);
      setOrder(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching order:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      processing: 'bg-purple-100 text-purple-800',
      shipped: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getDeliveryStatusColor = (status) => {
    const colors = {
      processing: 'bg-gray-100 text-gray-800',
      packed: 'bg-blue-100 text-blue-800',
      shipped: 'bg-indigo-100 text-indigo-800',
      'in-transit': 'bg-yellow-100 text-yellow-800',
      'out-for-delivery': 'bg-orange-100 text-orange-800',
      delivered: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-xl text-gray-600">Order not found</p>
        <Link to="/orders" className="text-red-600 hover:text-red-700 hover:underline mt-4 inline-block font-semibold">
          Back to Orders
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'package', label: 'Package Details' },
    { id: 'customer', label: 'Customer Info' },
    { id: 'shipping', label: 'Shipping Info' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/orders" className="text-red-600 hover:text-red-700 hover:underline mb-4 inline-block font-semibold">
        ← Back to Orders
      </Link>

      {/* Order Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Order #{order.orderID || order.id}
            </h1>
            <p className="text-gray-600">
              Tracking Number: <span className="font-semibold">{order.trackingNumber}</span>
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Submitted: {new Date(order.submissionTime || order.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-col md:items-end gap-2">
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium inline-block ${getStatusColor(
                order.status
              )}`}
            >
              Status: {order.status.toUpperCase()}
            </span>
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium inline-block ${getDeliveryStatusColor(
                order.deliveryStatus
              )}`}
            >
              Delivery: {order.deliveryStatus.replace('-', ' ').toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b-2 border-black">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-bold border-b-2 transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-black border-transparent hover:bg-red-50 hover:text-red-600 hover:border-red-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg p-4 border-2 border-gray-200 hover:border-red-600 transition-colors">
                  <h3 className="text-sm font-medium text-black mb-1 font-semibold">Order ID</h3>
                  <p className="text-lg font-semibold text-black">{order.orderID || order.id}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border-2 border-gray-200 hover:border-red-600 transition-colors">
                  <h3 className="text-sm font-medium text-black mb-1 font-semibold">Tracking Number</h3>
                  <p className="text-lg font-semibold text-red-600">{order.trackingNumber}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border-2 border-gray-200 hover:border-red-600 transition-colors">
                  <h3 className="text-sm font-medium text-black mb-1 font-semibold">Package Name</h3>
                  <p className="text-lg font-semibold text-black">{order.packageName || 'N/A'}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border-2 border-gray-200 hover:border-red-600 transition-colors">
                  <h3 className="text-sm font-medium text-black mb-1 font-semibold">Weight</h3>
                  <p className="text-lg font-semibold text-black">{order.weight} kg</p>
                </div>
                <div className="bg-white rounded-lg p-4 border-2 border-gray-200 hover:border-red-600 transition-colors">
                  <h3 className="text-sm font-medium text-black mb-1 font-semibold">Origin</h3>
                  <p className="text-lg font-semibold text-black">{order.origin?.country || 'N/A'}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border-2 border-gray-200 hover:border-red-600 transition-colors">
                  <h3 className="text-sm font-medium text-black mb-1 font-semibold">Destination</h3>
                  <p className="text-lg font-semibold text-black">{order.destination?.country || 'N/A'}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-red-600">
                <h3 className="text-sm font-medium text-black mb-2 font-semibold">Route</h3>
                <p className="text-xl font-semibold text-black">
                  {order.origin?.country || 'N/A'} <span className="text-red-600">→</span> {order.destination?.country || 'N/A'}
                </p>
              </div>
            </div>
          )}

          {/* Package Details Tab */}
          {activeTab === 'package' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-6 border-l-4 border-red-600">
                <h2 className="text-xl font-bold mb-4 text-black">Package Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Package Name/Description
                    </label>
                    <p className="text-lg font-semibold">{order.packageName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Weight
                    </label>
                    <p className="text-lg font-semibold">{order.weight} kg</p>
                  </div>
                  {order.measurements && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Length
                        </label>
                        <p className="text-lg font-semibold">
                          {order.measurements.length} {order.measurements.unit || 'cm'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Width
                        </label>
                        <p className="text-lg font-semibold">
                          {order.measurements.width} {order.measurements.unit || 'cm'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Height
                        </label>
                        <p className="text-lg font-semibold">
                          {order.measurements.height} {order.measurements.unit || 'cm'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Dimensions
                        </label>
                        <p className="text-lg font-semibold">
                          {order.measurements.length} × {order.measurements.width} × {order.measurements.height} {order.measurements.unit || 'cm'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Customer Info Tab */}
          {activeTab === 'customer' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-6 border-l-4 border-red-600">
                <h2 className="text-xl font-bold mb-4 text-black">Customer Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Customer Name
                    </label>
                    <p className="text-lg font-semibold">{order.customerName || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 border-l-4 border-red-600">
                <h2 className="text-xl font-bold mb-4 text-black">Receiver Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Receiver Name
                    </label>
                    <p className="text-lg font-semibold">{order.receiverName || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 border-l-4 border-red-600">
                <h2 className="text-xl font-bold mb-4 text-black">Sender Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {order.sender && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Sender Name
                        </label>
                        <p className="text-lg font-semibold">{order.sender.name || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Phone Number
                        </label>
                        <p className="text-lg font-semibold">{order.sender.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Email Address
                        </label>
                        <p className="text-lg font-semibold">{order.sender.email || 'N/A'}</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Pickup Address
                        </label>
                        <p className="text-lg font-semibold whitespace-pre-line">
                          {order.sender.address || 'N/A'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Shipping Info Tab */}
          {activeTab === 'shipping' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-6 border-l-4 border-red-600">
                <h2 className="text-xl font-bold mb-4 text-black">Origin & Destination</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">
                      Origin Country
                    </label>
                    <div className="bg-white rounded-lg p-4 border-2 border-red-600">
                      <p className="text-xl font-semibold text-red-600">
                        {order.origin?.country || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">
                      Destination Country
                    </label>
                    <div className="bg-white rounded-lg p-4 border-2 border-red-600">
                      <p className="text-xl font-semibold text-red-600">
                        {order.destination?.country || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 text-center">
                  <div className="inline-flex items-center gap-4 bg-white rounded-lg p-4 border-2 border-black">
                    <span className="text-lg font-semibold text-black">{order.origin?.country || 'N/A'}</span>
                    <span className="text-2xl text-red-600 font-bold">→</span>
                    <span className="text-lg font-semibold text-black">{order.destination?.country || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 border-l-4 border-red-600">
                <h2 className="text-xl font-bold mb-4 text-black">Order Timeline</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-3 h-3 rounded-full bg-red-600 mt-2"></div>
                    <div>
                      <p className="font-semibold text-black">Order Created</p>
                      <p className="text-sm text-gray-600">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-3 h-3 rounded-full bg-black mt-2"></div>
                    <div>
                      <p className="font-semibold text-black">Status: {order.status}</p>
                      <p className="text-sm text-gray-600">
                        Delivery Status: {order.deliveryStatus}
                      </p>
                    </div>
                  </div>
                  {order.updatedAt && order.updatedAt !== order.createdAt && (
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-3 h-3 rounded-full bg-black mt-2"></div>
                      <div>
                        <p className="font-semibold text-black">Last Updated</p>
                        <p className="text-sm text-gray-600">
                          {new Date(order.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;