import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { productsAPI, ordersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    freightType: 'air', // Default to air freight (>50%)
    origin: '',
    destination: '',
    weight: '',
    volume: '',
    estimatedCost: 0,
    estimatedTime: '',
  });

  useEffect(() => {
    fetchShipment();
  }, [id]);

  useEffect(() => {
    calculateEstimate();
  }, [formData.freightType, formData.weight, formData.volume, formData.origin, formData.destination]);

  const fetchShipment = async () => {
    try {
      const response = await productsAPI.getById(id);
      setShipment(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching shipment:', error);
      setLoading(false);
    }
  };

  const calculateEstimate = () => {
    if (!formData.weight || !formData.volume || !formData.origin || !formData.destination) {
      setFormData(prev => ({ ...prev, estimatedCost: 0, estimatedTime: '' }));
      return;
    }

    const weight = parseFloat(formData.weight) || 0;
    const volume = parseFloat(formData.volume) || 0;
    
    // Base rates per kg/m³
    const rates = {
      air: { cost: 8.5, time: '3-5 days' },      // >50% usage
      sea: { cost: 2.2, time: '15-30 days' },     // 30% usage
      land: { cost: 1.5, time: '5-10 days' },    // 20% usage
    };

    const selectedRate = rates[formData.freightType];
    const baseCost = (weight * selectedRate.cost) + (volume * selectedRate.cost * 0.3);
    const distanceMultiplier = formData.origin && formData.destination ? 1.2 : 1;
    
    setFormData(prev => ({
      ...prev,
      estimatedCost: Math.round(baseCost * distanceMultiplier),
      estimatedTime: selectedRate.time,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateShipment = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!formData.origin || !formData.destination || !formData.weight || !formData.volume) {
      setMessage('Please fill in all required fields');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setSubmitting(true);
    try {
      const orderData = {
        items: [{
          productId: shipment.id,
          quantity: 1,
        }],
        shippingAddress: `${formData.origin} → ${formData.destination}`,
        paymentMethod: 'wire_transfer',
        notes: `Freight Type: ${formData.freightType.toUpperCase()}, Weight: ${formData.weight}kg, Volume: ${formData.volume}m³`,
        freightType: formData.freightType,
        estimatedCost: formData.estimatedCost,
        estimatedTime: formData.estimatedTime,
      };

      const response = await ordersAPI.create(orderData);
      setMessage('Shipment created successfully!');
      setTimeout(() => {
        navigate(`/orders/${response.data.id}`);
      }, 1500);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to create shipment');
      setTimeout(() => setMessage(''), 3000);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-xl text-gray-600">Shipment not found</p>
        <Link to="/shipments" className="text-primary-600 hover:underline mt-4 inline-block">
          Back to Shipments
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/shipments" className="text-primary-600 hover:underline mb-4 inline-block">
        ← Back to Shipments
      </Link>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-8">
          {/* Shipment Info */}
          <div className="lg:col-span-1">
            <img
              src={shipment.image}
              alt={shipment.name}
              className="w-full h-64 object-cover rounded-lg mb-4"
            />
            <h1 className="text-3xl font-bold mb-4">{shipment.name}</h1>
            <p className="text-gray-600 mb-6">{shipment.description}</p>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Category: {shipment.category}</p>
              {shipment.stock > 0 ? (
                <p className="text-green-600 font-semibold">
                  Available ({shipment.stock} units)
                </p>
              ) : (
                <p className="text-red-600 font-semibold">Unavailable</p>
              )}
            </div>
          </div>

          {/* Shipment Configuration */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold mb-6">Configure Shipment</h2>

            {message && (
              <div
                className={`mb-4 p-3 rounded ${
                  message.includes('successfully') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {message}
              </div>
            )}

            <div className="space-y-6">
              {/* Freight Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Freight Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <label className={`relative flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition ${
                    formData.freightType === 'air' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="freightType"
                      value="air"
                      checked={formData.freightType === 'air'}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <span className="text-3xl mb-2">✈️</span>
                    <span className="font-semibold text-gray-900">Air Freight</span>
                    <span className="text-xs text-gray-500 mt-1">>50% usage</span>
                    <span className="text-xs text-blue-600 mt-1">Fastest</span>
                  </label>
                  <label className={`relative flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition ${
                    formData.freightType === 'sea' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="freightType"
                      value="sea"
                      checked={formData.freightType === 'sea'}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <span className="text-3xl mb-2">🚢</span>
                    <span className="font-semibold text-gray-900">Sea Freight</span>
                    <span className="text-xs text-gray-500 mt-1">30% usage</span>
                    <span className="text-xs text-blue-600 mt-1">Economical</span>
                  </label>
                  <label className={`relative flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition ${
                    formData.freightType === 'land' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="freightType"
                      value="land"
                      checked={formData.freightType === 'land'}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <span className="text-3xl mb-2">🚛</span>
                    <span className="font-semibold text-gray-900">Land Freight</span>
                    <span className="text-xs text-gray-500 mt-1">20% usage</span>
                    <span className="text-xs text-blue-600 mt-1">Regional</span>
                  </label>
                </div>
              </div>

              {/* Origin and Destination */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Origin <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="origin"
                    value={formData.origin}
                    onChange={handleChange}
                    placeholder="e.g., New York, USA"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Destination <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="destination"
                    value={formData.destination}
                    onChange={handleChange}
                    placeholder="e.g., London, UK"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500"
                    required
                  />
                </div>
              </div>

              {/* Weight and Volume */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weight (kg) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleChange}
                    placeholder="e.g., 1000"
                    min="0"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Volume (m³) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="volume"
                    value={formData.volume}
                    onChange={handleChange}
                    placeholder="e.g., 5.5"
                    min="0"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500"
                    required
                  />
                </div>
              </div>

              {/* Estimated Cost and Time */}
              {(formData.estimatedCost > 0 || formData.estimatedTime) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Route Optimization Estimate</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Estimated Cost</p>
                      <p className="text-2xl font-bold text-blue-600">
                        ${formData.estimatedCost.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Estimated Transit Time</p>
                      <p className="text-2xl font-bold text-blue-600">{formData.estimatedTime}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    * Estimates are based on current rates and route optimization algorithms
                  </p>
                </div>
              )}

              {/* Create Shipment Button */}
              <button
                onClick={handleCreateShipment}
                disabled={submitting || !user || !formData.origin || !formData.destination || !formData.weight || !formData.volume}
                className="w-full bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating Shipment...' : user ? 'Create Shipment & Optimize Route' : 'Login to Create Shipment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
