const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../utils/database');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Public route to get order by orderID (for tracking)
router.get('/track/:orderID', async (req, res) => {
  try {
    const order = await db.get('orders').find({ orderID: req.params.orderID }).value();
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    // Return order without sensitive user information
    const { userId, ...orderData } = order;
    res.json(orderData);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// All other order routes require authentication
router.use(authenticateToken);

// Get user orders
router.get('/', async (req, res) => {
  try {
    const orders = await db.get('orders').filter({ userId: req.userId }).value();
    
    // Return orders (new format doesn't require product population)
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get order by ID
router.get('/:id', async (req, res) => {
  try {
    const order = await db.get('orders').find({ id: req.params.id, userId: req.userId }).value();
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Return order (new format doesn't require product population)
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Generate unique orderID
function generateOrderID() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD-${timestamp}${random}`;
}

// Create order
router.post('/', [
  body('packageName').notEmpty(),
  body('measurements.length').isFloat({ min: 0 }),
  body('measurements.width').isFloat({ min: 0 }),
  body('measurements.height').isFloat({ min: 0 }),
  body('weight').isFloat({ min: 0 }),
  body('customerName').notEmpty(),
  body('receiverName').notEmpty(),
  body('sender.name').notEmpty(),
  body('sender.phone').notEmpty(),
  body('sender.email').isEmail(),
  body('sender.address').notEmpty(),
  body('origin.country').notEmpty(),
  body('destination.country').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      packageName,
      measurements,
      weight,
      customerName,
      receiverName,
      sender,
      origin,
      destination
    } = req.body;

    // Generate unique orderID
    let orderID;
    let isUnique = false;
    while (!isUnique) {
      orderID = generateOrderID();
      const existingOrder = await db.get('orders').find({ orderID }).value();
      if (!existingOrder) {
        isUnique = true;
      }
    }

    // Get current timestamp for submission time
    const submissionTime = new Date().toISOString();

    // Create order
    const order = {
      id: uuidv4(),
      orderID: orderID,
      userId: req.userId,
      packageName: packageName,
      measurements: measurements,
      weight: parseFloat(weight),
      customerName: customerName,
      receiverName: receiverName,
      sender: {
        name: sender.name,
        phone: sender.phone,
        email: sender.email,
        address: sender.address,
      },
      origin: {
        country: origin.country,
      },
      destination: {
        country: destination.country,
      },
      submissionTime: submissionTime,
      status: 'pending',
      deliveryStatus: 'processing',
      trackingNumber: `TRK${Date.now()}`,
      createdAt: submissionTime,
      updatedAt: submissionTime
    };

    await db.get('orders').push(order);

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update order status (for admin - simplified for demo)
router.put('/:id/status', [
  body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const order = await db.get('orders').find({ id: req.params.id }).value();
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await db.get('orders').find({ id: req.params.id }).assign({
      status: req.body.status,
      updatedAt: new Date().toISOString()
    });

    const updatedOrder = await db.get('orders').find({ id: req.params.id }).value();
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update delivery status
router.put('/:id/track', [
  body('deliveryStatus').isIn(['processing', 'packed', 'shipped', 'in-transit', 'out-for-delivery', 'delivered'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const order = await db.get('orders').find({ id: req.params.id }).value();
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await db.get('orders').find({ id: req.params.id }).assign({
      deliveryStatus: req.body.deliveryStatus,
      updatedAt: new Date().toISOString()
    });

    const updatedOrder = await db.get('orders').find({ id: req.params.id }).value();
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;