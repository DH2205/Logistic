const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../utils/database');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get all locations (public - needed for map)
router.get('/', async (req, res) => {
  try {
    const locations = await db.get('locations').value();
    res.json(locations || []);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// All other location routes require authentication
router.use(authenticateToken);

// Get location by ID (public - needed for map)
router.get('/:id', async (req, res) => {
  try {
    const location = await db.get('locations').find({ id: req.params.id }).value();
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }
    res.json(location);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get locations by type (public - needed for map)
router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['storage', 'airport', 'seaport'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid location type' });
    }
    const locations = await db.get('locations').filter({ type }).value();
    res.json(locations || []);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create location
router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('type').isIn(['storage', 'airport', 'seaport']).withMessage('Type must be storage, airport, or seaport'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  body('address').optional().trim(),
  body('city').optional().trim(),
  body('country').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      type,
      latitude,
      longitude,
      address,
      city,
      country,
      description
    } = req.body;

    // Check if location with same coordinates already exists
    const existingLocation = await db.get('locations').find({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    }).value();

    if (existingLocation) {
      return res.status(400).json({ message: 'Location with these coordinates already exists' });
    }

    const location = {
      id: uuidv4(),
      name,
      type,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: address || '',
      city: city || '',
      country: country || '',
      description: description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.get('locations').push(location);

    res.status(201).json(location);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update location
router.put('/:id', [
  body('name').optional().trim().notEmpty(),
  body('type').optional().isIn(['storage', 'airport', 'seaport']),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const location = await db.get('locations').find({ id: req.params.id }).value();
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    const updates = {
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    // Convert latitude/longitude to numbers if provided
    if (updates.latitude) updates.latitude = parseFloat(updates.latitude);
    if (updates.longitude) updates.longitude = parseFloat(updates.longitude);

    await db.get('locations').find({ id: req.params.id }).assign(updates);

    const updatedLocation = await db.get('locations').find({ id: req.params.id }).value();
    res.json(updatedLocation);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete location
router.delete('/:id', async (req, res) => {
  try {
    const location = await db.get('locations').find({ id: req.params.id }).value();
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    await db.get('locations').find({ id: req.params.id }).remove();

    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
