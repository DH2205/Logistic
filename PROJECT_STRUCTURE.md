# Project Structure

## Directory Layout

```
logistics-web-app/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   │   └── Layout.jsx
│   │   ├── context/        # React Context
│   │   │   └── AuthContext.jsx
│   │   ├── pages/          # Page components
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Products.jsx
│   │   │   ├── ProductDetail.jsx
│   │   │   ├── Cart.jsx
│   │   │   ├── Checkout.jsx
│   │   │   ├── Orders.jsx
│   │   │   └── OrderDetail.jsx
│   │   ├── services/       # API services
│   │   │   └── api.js
│   │   ├── utils/          # Utility functions
│   │   │   └── auth.js
│   │   ├── App.jsx         # Main app component with routing
│   │   └── main.jsx        # Entry point
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── server/                 # Express Backend
│   ├── routes/             # API routes
│   │   ├── auth.js        # Authentication routes
│   │   ├── products.js    # Product routes
│   │   ├── cart.js        # Cart routes
│   │   └── orders.js      # Order routes
│   ├── middleware/         # Express middleware
│   │   └── auth.js        # Authentication middleware
│   ├── utils/              # Utility functions
│   │   ├── database.js    # Database helper (JSON file-based)
│   │   └── auth.js        # Auth utilities (JWT, bcrypt)
│   ├── data/               # Database files (auto-created)
│   │   └── db.json        # JSON database file
│   ├── index.js           # Server entry point
│   └── package.json
│
├── package.json           # Root package.json
├── README.md              # Main documentation
├── INSTALLATION.md        # Installation guide
└── .gitignore            # Git ignore rules
```

## Key Features

### Frontend (React + Vite)
- **Routing**: React Router for navigation
- **State Management**: React Context API for authentication
- **Styling**: Tailwind CSS for responsive design
- **API Communication**: Axios with interceptors
- **Authentication**: JWT token-based authentication

### Backend (Express + Node.js)
- **Database**: JSON file-based database (lowdb-style, simplified)
- **Authentication**: JWT tokens + bcrypt password hashing
- **Validation**: express-validator for input validation
- **CORS**: Enabled for frontend communication

## API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - User login
- `GET /me` - Get current user (requires auth)

### Products (`/api/products`)
- `GET /` - Get all products (supports filters)
- `GET /:id` - Get product by ID
- `POST /` - Create product (requires auth)
- `PUT /:id` - Update product (requires auth)
- `DELETE /:id` - Delete product (requires auth)

### Cart (`/api/cart`)
- `GET /` - Get user cart (requires auth)
- `POST /` - Add item to cart (requires auth)
- `PUT /:itemId` - Update cart item (requires auth)
- `DELETE /:itemId` - Remove item from cart (requires auth)
- `DELETE /` - Clear cart (requires auth)

### Orders (`/api/orders`)
- `GET /` - Get user orders (requires auth)
- `GET /:id` - Get order by ID (requires auth)
- `POST /` - Create order (requires auth)
- `PUT /:id/status` - Update order status (requires auth)
- `PUT /:id/track` - Update delivery status (requires auth)

## Database Schema

### Users
```javascript
{
  id: string,
  email: string,
  password: string (hashed),
  name: string,
  phone: string,
  address: string,
  role: string ('user' | 'admin'),
  createdAt: string (ISO date)
}
```

### Products
```javascript
{
  id: string,
  name: string,
  description: string,
  price: number,
  image: string (URL),
  category: string,
  stock: number,
  rating: number,
  reviews: number,
  createdAt: string (ISO date)
}
```

### Carts
```javascript
{
  userId: string,
  items: [
    {
      id: string,
      productId: string,
      quantity: number
    }
  ]
}
```

### Orders
```javascript
{
  id: string,
  userId: string,
  items: [
    {
      productId: string,
      quantity: number,
      price: number,
      subtotal: number
    }
  ],
  total: number,
  shippingAddress: string,
  paymentMethod: string,
  notes: string,
  status: string,
  deliveryStatus: string,
  trackingNumber: string,
  createdAt: string (ISO date),
  updatedAt: string (ISO date)
}
```

## Environment Variables

### Server (.env)
```
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
DB_FILE=./data/db.json
```

### Client (.env - optional)
```
VITE_API_URL=http://localhost:5000/api
```

## Next Steps for Production

1. **Database**: Replace JSON file storage with MongoDB/PostgreSQL
2. **Authentication**: Implement refresh tokens
3. **Validation**: Add more robust input validation
4. **Error Handling**: Improve error messages and logging
5. **Testing**: Add unit and integration tests
6. **Security**: Add rate limiting, CSRF protection
7. **File Upload**: Implement image upload for products
8. **Payment**: Integrate payment gateway (Stripe, PayPal, etc.)
9. **Email**: Add email notifications for orders
10. **Admin Panel**: Create admin interface for product management
