const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../utils/database');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get all products
router.get('/', (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, sort } = req.query;
    let products = db.get('products').value();

    // Filter by category
    if (category) {
      products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }

    // Search by name or description
    if (search) {
      const searchLower = search.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }

    // Filter by price range
    if (minPrice) {
      products = products.filter(p => p.price >= parseFloat(minPrice));
    }
    if (maxPrice) {
      products = products.filter(p => p.price <= parseFloat(maxPrice));
    }

    // Sort
    if (sort === 'price-asc') {
      products.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-desc') {
      products.sort((a, b) => b.price - a.price);
    } else if (sort === 'rating') {
      products.sort((a, b) => b.rating - a.rating);
    }

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get product by ID
router.get('/:id', (req, res) => {
  try {
    const product = db.get('products').find({ id: req.params.id }).value();
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create product (Admin only - for demo purposes, allowing authenticated users)
router.post('/', authenticateToken, [
  body('name').trim().notEmpty(),
  body('price').isFloat({ min: 0 }),
  body('stock').isInt({ min: 0 }),
  body('category').trim().notEmpty()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, price, image, category, stock } = req.body;

    const product = {
      id: uuidv4(),
      name,
      description: description || '',
      price: parseFloat(price),
      image: image || 'https://via.placeholder.com/300x300?text=Product',
      category,
      stock: parseInt(stock),
      rating: 0,
      reviews: 0,
      createdAt: new Date().toISOString()
    };

    db.get('products').push(product).write();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update product
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const product = db.get('products').find({ id: req.params.id }).value();
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const updates = req.body;
    db.get('products').find({ id: req.params.id }).assign(updates).write();
    
    const updatedProduct = db.get('products').find({ id: req.params.id }).value();
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete product
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const product = db.get('products').find({ id: req.params.id }).value();
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    db.get('products').remove({ id: req.params.id }).write();
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;