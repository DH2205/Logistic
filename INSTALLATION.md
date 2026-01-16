# Installation Guide

## Quick Start

1. **Install all dependencies:**
   ```bash
   npm run install-all
   ```

2. **Set up environment variables:**
   - Copy `server/.env.example` to `server/.env` (if the file exists)
   - Or create `server/.env` with:
     ```
     PORT=5000
     JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
     NODE_ENV=development
     DB_FILE=./data/db.json
     ```

3. **Run the development servers:**
   ```bash
   npm run dev
   ```

   This will start:
   - Backend server on `http://localhost:5000`
   - Frontend development server on `http://localhost:5173`

## Manual Installation

If you prefer to install separately:

### Backend Setup
```bash
cd server
npm install
npm run dev
```

### Frontend Setup
```bash
cd client
npm install
npm run dev
```

## Features

- ✅ User Authentication (Register/Login)
- ✅ Product Catalog with Search and Filters
- ✅ Shopping Cart
- ✅ Order Management
- ✅ Delivery Tracking
- ✅ Responsive Design with Tailwind CSS

## Default Data

The application comes with 6 sample products pre-loaded:
- Wireless Headphones
- Smartphone Case
- Laptop Stand
- Wireless Mouse
- USB-C Cable
- Desk Organizer

## Testing the Application

1. Register a new account at `/register`
2. Browse products at `/products`
3. Add items to cart
4. Checkout and place an order
5. Track your orders at `/orders`

## Troubleshooting

- **Port already in use**: Change the PORT in `server/.env`
- **Database errors**: Ensure the `server/data` directory has write permissions
- **CORS errors**: Check that backend is running on port 5000
