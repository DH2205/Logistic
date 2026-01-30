// API client for Next.js
'use client';

import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (userData: any) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
};

// Products API
export const productsAPI = {
  getAll: (params?: any) => api.get('/products', { params }),
  getById: (id: string) => api.get(`/products/${id}`),
  create: (product: any) => api.post('/products', product),
  update: (id: string, product: any) => api.put(`/products/${id}`, product),
  delete: (id: string) => api.delete(`/products/${id}`),
};

// Orders API
export const ordersAPI = {
  getAll: () => api.get('/orders'),
  getById: (id: string) => api.get(`/orders/${id}`),
  getByOrderID: (orderID: string) => api.get(`/orders/track/${orderID}`),
  create: (orderData: any) => api.post('/orders', orderData),
  updateStatus: (id: string, status: string) => api.put(`/orders/${id}/status`, { status }),
  updateDelivery: (id: string, deliveryStatus: string) => api.put(`/orders/${id}/track`, { deliveryStatus }),
};

// Locations API
export const locationsAPI = {
  getAll: () => api.get('/locations'),
  getById: (id: string) => api.get(`/locations/${id}`),
  getByType: (type: string) => api.get(`/locations/type/${type}`),
  create: (locationData: any) => api.post('/locations', locationData),
  update: (id: string, locationData: any) => api.put(`/locations/${id}`, locationData),
  delete: (id: string) => api.delete(`/locations/${id}`),
};

// Database API
export const databaseAPI = {
  getDatabase: () => api.get('/database'),
};

export default api;
