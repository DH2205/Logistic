import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CreateOrder = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    // Package information
    packageName: '',
    length: '',
    width: '',
    height: '',
    weight: '',
    
    // Customer information
    customerName: '',
    
    // Receiver information
    receiverName: '',
    
    // Sender information
    senderName: '',
    senderPhone: '',
    senderEmail: '',
    senderAddress: '',
    
    // Destination information
    countryFrom: '',
    countryTo: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      navigate('/login');
      return;
    }

    // Validate required fields
    const requiredFields = [
      'packageName', 'length', 'width', 'height', 'weight',
      'customerName', 'receiverName',
      'senderName', 'senderPhone', 'senderEmail', 'senderAddress',
      'countryFrom', 'countryTo'
    ];

    const missingFields = requiredFields.filter(field => !formData[field]);
    if (missingFields.length > 0) {
      setMessage(`Please fill in all required fields: ${missingFields.join(', ')}`);
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const orderData = {
        packageName: formData.packageName,
        measurements: {
          length: parseFloat(formData.length),
          width: parseFloat(formData.width),
          height: parseFloat(formData.height),
          unit: 'cm'
        },
        weight: parseFloat(formData.weight),
        customerName: formData.customerName,
        receiverName: formData.receiverName,
        sender: {
          name: formData.senderName,
          phone: formData.senderPhone,
          email: formData.senderEmail,
          address: formData.senderAddress,
        },
        origin: {
          country: formData.countryFrom,
        },
        destination: {
          country: formData.countryTo,
        },
        // Time of submission will be set automatically on the backend
      };

      const response = await ordersAPI.create(orderData);
      setMessage('Order created successfully!');
      setTimeout(() => {
        navigate(`/orders/${response.data.id}`);
      }, 1500);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to create order. Please try again.');
      setSubmitting(false);
    }
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Create New Order</h1>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.includes('successfully') 
                ? 'bg-green-100 text-green-700 border border-green-300' 
                : 'bg-red-100 text-red-700 border border-red-300'
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8 space-y-8">
          {/* Package Information Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-4 pb-2 border-b border-gray-200">Package Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Package Name/Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="packageName"
                  value={formData.packageName}
                  onChange={handleChange}
                  placeholder="e.g., Electronics, Clothing, Documents"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Length (cm) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="length"
                  value={formData.length}
                  onChange={handleChange}
                  placeholder="e.g., 50"
                  min="0"
                  step="0.1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Width (cm) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="width"
                  value={formData.width}
                  onChange={handleChange}
                  placeholder="e.g., 30"
                  min="0"
                  step="0.1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Height (cm) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="height"
                  value={formData.height}
                  onChange={handleChange}
                  placeholder="e.g., 20"
                  min="0"
                  step="0.1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weight (kg) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  placeholder="e.g., 5.5"
                  min="0"
                  step="0.1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Customer Information Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-4 pb-2 border-b border-gray-200">Customer Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleChange}
                  placeholder="Full name of the customer"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Receiver Information Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-4 pb-2 border-b border-gray-200">Receiver Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Receiver Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="receiverName"
                  value={formData.receiverName}
                  onChange={handleChange}
                  placeholder="Full name of the receiver"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Sender Information Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-4 pb-2 border-b border-gray-200">Sender Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sender Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="senderName"
                  value={formData.senderName}
                  onChange={handleChange}
                  placeholder="Full name of the sender"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sender Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="senderPhone"
                  value={formData.senderPhone}
                  onChange={handleChange}
                  placeholder="e.g., +1 234 567 8900"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sender Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="senderEmail"
                  value={formData.senderEmail}
                  onChange={handleChange}
                  placeholder="sender@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="senderAddress"
                  value={formData.senderAddress}
                  onChange={handleChange}
                  placeholder="Full address for pickup"
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Destination Information Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-4 pb-2 border-b border-gray-200">Origin & Destination</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country From (Origin) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="countryFrom"
                  value={formData.countryFrom}
                  onChange={handleChange}
                  placeholder="e.g., United States"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country To (Destination) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="countryTo"
                  value={formData.countryTo}
                  onChange={handleChange}
                  placeholder="e.g., United Kingdom"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating Order...' : 'Create Order'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrder;
