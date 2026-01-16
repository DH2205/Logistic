# Quick Start Guide

## Step 1: Install Dependencies

Install all dependencies for root, server, and client:

```bash
npm run install-all
```

Or install them separately:

**Backend:**
```bash
cd server
npm install
cd ..
```

**Frontend:**
```bash
cd client
npm install
cd ..
```

**Root (for running both):**
```bash
npm install
```

## Step 2: Environment Setup

The `.env` file for the server has been created. If you need to modify it:

Edit `server/.env`:
```
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-12345
NODE_ENV=development
DB_FILE=./data/db.json
```

## Step 3: Run the Application

### Option 1: Run Both Together (Recommended)

From the root directory:
```bash
npm run dev
```

This will start both:
- Backend server on `http://localhost:5000`
- Frontend dev server on `http://localhost:5173`

### Option 2: Run Separately

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

## Step 4: Access the Application

Open your browser and go to:
```
http://localhost:5173
```

## Step 5: Test the Application

1. **Register a new account:**
   - Click "Register" in the header
   - Fill in your details
   - Submit the form

2. **Browse products:**
   - Go to "Products" in the navigation
   - Use filters to search
   - Click on any product to see details

3. **Add to cart:**
   - Click "Add to Cart" on any product
   - View your cart from the header

4. **Place an order:**
   - Go to Cart
   - Click "Proceed to Checkout"
   - Fill in shipping address
   - Select payment method
   - Place order

5. **Track orders:**
   - Go to "Orders" in the navigation
   - View order details and delivery status

## Troubleshooting

### Port Already in Use
If port 5000 or 5173 is already in use:
- Change `PORT` in `server/.env` for backend
- Change port in `client/vite.config.js` for frontend (add `server: { port: 3000 }`)

### Database Errors
- Ensure `server/data` directory exists (will be auto-created)
- Check file permissions

### CORS Errors
- Make sure backend is running on port 5000
- Check that frontend proxy is configured in `client/vite.config.js`

### Module Not Found Errors
- Make sure you've run `npm install` in both `server/` and `client/` directories
- Delete `node_modules` and `package-lock.json`, then reinstall

## Production Build

To build for production:

```bash
cd client
npm run build
```

The built files will be in `client/dist/`. Serve this with the backend server or a static file server.
