# Logistics Optimization Platform

A modern, full-stack international logistics optimization platform focused on shipment management, route optimization, and delivery tracking. Built with a professional, data-centric dashboard similar to Flexport or Freightos.

## Features

- 🔐 User Authentication (Login/Register)
- 📦 Shipment Management with search and filtering
- 🗺️ Route Visualization and Optimization
- 📊 Real-time Dashboard with Analytics
- 🚚 Delivery Tracking
- 👤 User Profile Management
- 📈 Performance Metrics and Charts
- 💰 Cost Optimization (time, route, and cost analysis)
- 🌍 International Freight Support:
  - ✈️ **Air Freight** (>50% usage) - Fastest delivery, optimized for time-sensitive shipments
  - 🚢 **Sea Freight** (30% usage) - Cost-effective for large volumes
  - 🚛 **Land Freight** (20% usage) - Regional and cross-border transportation

## Tech Stack

### Frontend
- React 18
- Vite
- React Router
- Axios
- Tailwind CSS

### Backend
- Node.js
- Express.js
- MongoDB / JSON File Storage
- JWT Authentication
- bcrypt

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install all dependencies:
```bash
npm run install-all
```

2. Set up environment variables:
- Copy `server/.env.example` to `server/.env`
- Configure your database connection and JWT secret

3. Run the development servers:
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend development server on `http://localhost:5173`

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
.
├── client/          # React frontend application
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── utils/
│   │   └── App.jsx
│   └── package.json
├── server/          # Express backend API
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── controllers/
│   └── index.js
└── package.json     # Root package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Shipments
- `GET /api/products` - Get all shipments
- `GET /api/products/:id` - Get shipment by ID
- `POST /api/products` - Create shipment (admin)
- `PUT /api/products/:id` - Update shipment (admin)
- `DELETE /api/products/:id` - Delete shipment (admin)

### Orders (Shipments)
- `GET /api/orders` - Get user orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id/track` - Update delivery status

## License

MIT