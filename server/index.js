const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const locationRoutes = require('./routes/locations');
const { initializeDatabase } = require('./utils/database');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database (synchronous initialization)
try {
  initializeDatabase();
  console.log('Database initialized successfully');
} catch (error) {
  console.error('Error initializing database:', error);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/locations', locationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Database endpoint - serve the database JSON file
app.get('/api/database', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const dbPath = process.env.DB_FILE || path.join(__dirname, 'data/db.json');
    
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      res.json(JSON.parse(data));
    } else {
      res.status(404).json({ message: 'Database file not found' });
    }
  } catch (error) {
    console.error('Error reading database:', error);
    res.status(500).json({ message: 'Error reading database', error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});