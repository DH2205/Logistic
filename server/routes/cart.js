const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../utils/database');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// All cart routes require authentication
router.use(authenticateToken);

// Get user cart
router.get('/', (req, res) => {
  try {
    let cart = db.get('carts').find({ userId: req.userId }).value();
    if (!cart) {
      cart = { userId: req.userId, items: [] };
      db.get('carts').push(cart);
    }

    // Populate product details
    const cartItems = cart.items.map(item => {
      const product = db.get('products').find({ id: item.productId }).value();
      if (product) {
        return {
          ...item,
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            stock: product.stock
          }
        };
      }
      return null;
    }).filter(item => item !== null);

    res.json({ items: cartItems });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add item to cart
router.post('/', [
  body('productId').notEmpty(),
  body('quantity').isInt({ min: 1 })
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, quantity } = req.body;

    // Check if product exists
    const product = db.get('products').find({ id: productId }).value();
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check stock
    if (product.stock < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    // Get or create cart
    let cart = db.get('carts').find({ userId: req.userId }).value();
    if (!cart) {
      cart = { userId: req.userId, items: [] };
      db.get('carts').push(cart);
      cart = db.get('carts').find({ userId: req.userId }).value();
    }
    
    // Check if item already in cart
    const existingItemIndex = cart.items.findIndex(item => item.productId === productId);
    let updatedItems;
    
    if (existingItemIndex !== -1) {
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      if (product.stock < newQuantity) {
        return res.status(400).json({ message: 'Insufficient stock' });
      }
      updatedItems = cart.items.map((item, idx) => 
        idx === existingItemIndex ? { ...item, quantity: newQuantity } : item
      );
    } else {
      updatedItems = [...cart.items, {
        id: uuidv4(),
        productId,
        quantity
      }];
    }

    db.get('carts').find({ userId: req.userId }).assign({ items: updatedItems });
    const updatedCart = db.get('carts').find({ userId: req.userId }).value();
    res.json({ message: 'Item added to cart', cart: updatedCart });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update cart item
router.put('/:itemId', [
  body('quantity').isInt({ min: 1 })
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { itemId } = req.params;
    const { quantity } = req.body;

    const cart = db.get('carts').find({ userId: req.userId }).value();
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const item = cart.items.find(i => i.id === itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    const product = db.get('products').find({ id: item.productId }).value();
    if (!product || product.stock < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    const updatedItems = cart.items.map(item => 
      item.id === itemId ? { ...item, quantity } : item
    );
    db.get('carts').find({ userId: req.userId }).assign({ items: updatedItems });
    res.json({ message: 'Cart item updated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove item from cart
router.delete('/:itemId', (req, res) => {
  try {
    const { itemId } = req.params;

    const cart = db.get('carts').find({ userId: req.userId }).value();
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const updatedItems = cart.items.filter(item => item.id !== itemId);
    db.get('carts').find({ userId: req.userId }).assign({ items: updatedItems });
    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Clear cart
router.delete('/', (req, res) => {
  try {
    db.get('carts').find({ userId: req.userId }).assign({ items: [] });
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;