// Script to seed airports into the database
// Run with: node server/scripts/seedAirports.js

require('dotenv').config();
const { seedAirports } = require('../utils/seedAirports');

console.log('Starting airport seeding...');
const result = seedAirports();
console.log(`Airport seeding completed. Added: ${result.added}, Total available: ${result.total}`);
process.exit(0);
