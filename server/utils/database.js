const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_FILE || path.join(__dirname, '../data/db.json');
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Simple synchronous JSON database helper
function readDb() {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading database:', error);
  }
  return {
    users: [],
    products: [],
    carts: [],
    orders: [],
    locations: []
  };
}

function writeDb(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    return false;
  }
}

// Initialize database with default structure
function initializeDatabase() {
  let data = readDb();

  // Seed initial products if database is empty
  if (!data.products || data.products.length === 0) {
    data.products = seedProducts();
    writeDb(data);
  }

  // Seed airports if locations is empty or has no airports
  // Check if there are any airports in the database
  const existingAirports = (data.locations || []).filter(loc => loc.type === 'airport');
  if (existingAirports.length === 0) {
    try {
      const { seedAirports } = require('./seedAirports');
      const result = seedAirports();
      console.log(`Airport seeding completed. Added: ${result.added}, Total available: ${result.total}`);
    } catch (error) {
      console.error('Error seeding airports during initialization:', error);
    }
  }
}

function seedProducts() {
  return [
    {
      id: '1',
      name: 'Wireless Headphones',
      description: 'High-quality wireless headphones with noise cancellation',
      price: 79.99,
      image: 'https://via.placeholder.com/300x300?text=Headphones',
      category: 'Electronics',
      stock: 50,
      rating: 4.5,
      reviews: 120,
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Smartphone Case',
      description: 'Durable smartphone case with shock protection',
      price: 19.99,
      image: 'https://via.placeholder.com/300x300?text=Phone+Case',
      category: 'Accessories',
      stock: 100,
      rating: 4.2,
      reviews: 85,
      createdAt: new Date().toISOString()
    },
    {
      id: '3',
      name: 'Laptop Stand',
      description: 'Adjustable aluminum laptop stand for better ergonomics',
      price: 49.99,
      image: 'https://via.placeholder.com/300x300?text=Laptop+Stand',
      category: 'Accessories',
      stock: 30,
      rating: 4.7,
      reviews: 200,
      createdAt: new Date().toISOString()
    },
    {
      id: '4',
      name: 'Wireless Mouse',
      description: 'Ergonomic wireless mouse with long battery life',
      price: 29.99,
      image: 'https://via.placeholder.com/300x300?text=Mouse',
      category: 'Electronics',
      stock: 75,
      rating: 4.4,
      reviews: 150,
      createdAt: new Date().toISOString()
    },
    {
      id: '5',
      name: 'USB-C Cable',
      description: 'Fast charging USB-C cable 2m length',
      price: 12.99,
      image: 'https://via.placeholder.com/300x300?text=USB+Cable',
      category: 'Accessories',
      stock: 200,
      rating: 4.3,
      reviews: 300,
      createdAt: new Date().toISOString()
    },
    {
      id: '6',
      name: 'Desk Organizer',
      description: 'Modern desk organizer with multiple compartments',
      price: 24.99,
      image: 'https://via.placeholder.com/300x300?text=Desk+Organizer',
      category: 'Office',
      stock: 60,
      rating: 4.6,
      reviews: 90,
      createdAt: new Date().toISOString()
    }
  ];
}

// Database helper object
const db = {
  get: (collection) => {
    const data = readDb();
    return {
      find: (query) => ({
        value: () => data[collection]?.find(item => {
          return Object.keys(query).every(key => item[key] === query[key]);
        }),
        assign: (updates) => {
          const item = data[collection]?.find(i => {
            return Object.keys(query).every(key => i[key] === query[key]);
          });
          if (item) {
            Object.assign(item, updates);
            writeDb(data);
          }
          return {
            write: () => writeDb(data),
            value: () => item ? { ...item, ...updates } : null
          };
        },
        remove: () => {
          const index = data[collection]?.findIndex(i => {
            return Object.keys(query).every(key => i[key] === query[key]);
          });
          if (index !== -1) {
            data[collection].splice(index, 1);
            writeDb(data);
          }
          return {
            write: () => writeDb(data)
          };
        }
      }),
      filter: (query) => ({
        value: () => {
          if (typeof query === 'function') {
            return data[collection]?.filter(query) || [];
          }
          return data[collection]?.filter(item => {
            return Object.keys(query).every(key => item[key] === query[key]);
          }) || [];
        }
      }),
      push: (item) => {
        if (!data[collection]) {
          data[collection] = [];
        }
        data[collection].push(item);
        writeDb(data);
        return {
          write: () => writeDb(data),
          value: () => data[collection]
        };
      },
      value: () => data[collection] || [],
      find: (query) => ({
        value: () => data[collection]?.find(item => {
          return Object.keys(query).every(key => item[key] === query[key]);
        }),
        get: (path) => {
          const item = data[collection]?.find(i => {
            return Object.keys(query).every(key => i[key] === query[key]);
          });
          const pathParts = path.split('.');
          let result = item;
          for (const part of pathParts) {
            result = result?.[part];
          }
          return {
            find: (itemQuery) => {
              const items = Array.isArray(result) ? result : [];
              const foundItem = items.find(i => {
                return Object.keys(itemQuery).every(key => i[key] === itemQuery[key]);
              });
              return {
                assign: (updates) => {
                  if (foundItem) {
                    Object.assign(foundItem, updates);
                    writeDb(data);
                  }
                  return {
                    write: () => writeDb(data)
                  };
                },
                value: () => foundItem
              };
            },
            push: (newItem) => {
              if (!result) {
                if (item) {
                  item[pathParts[pathParts.length - 1]] = [];
                  result = item[pathParts[pathParts.length - 1]];
                }
              }
              if (Array.isArray(result)) {
                result.push(newItem);
                writeDb(data);
              }
              return {
                write: () => writeDb(data),
                value: () => result
              };
            },
            remove: (itemQuery) => {
              if (Array.isArray(result)) {
                const index = result.findIndex(i => {
                  return Object.keys(itemQuery).every(key => i[key] === itemQuery[key]);
                });
                if (index !== -1) {
                  result.splice(index, 1);
                  writeDb(data);
                }
              }
              return {
                write: () => writeDb(data)
              };
            },
            assign: (updates) => {
              if (item) {
                const lastPart = pathParts[pathParts.length - 1];
                if (!item[lastPart]) {
                  item[lastPart] = {};
                }
                Object.assign(item[lastPart], updates);
                writeDb(data);
              }
              return {
                write: () => { if (item) writeDb(data); },
                value: () => item?.[pathParts[pathParts.length - 1]]
              };
            },
            value: () => result
          };
        },
        assign: (updates) => {
          const item = data[collection]?.find(i => {
            return Object.keys(query).every(key => i[key] === query[key]);
          });
          if (item) {
            Object.assign(item, updates);
            writeDb(data);
          }
          return {
            write: () => writeDb(data),
            value: () => item ? { ...item, ...updates } : null
          };
        },
        remove: () => {
          const index = data[collection]?.findIndex(i => {
            return Object.keys(query).every(key => i[key] === query[key]);
          });
          if (index !== -1) {
            data[collection].splice(index, 1);
            writeDb(data);
          }
          return {
            write: () => writeDb(data)
          };
        }
      })
    };
  }
};

// Check if Supabase is configured, use it if available, otherwise use JSON file
const { db: supabaseDb } = require('./supabase');

// Use Supabase if available, otherwise fall back to JSON file
const USE_SUPABASE = process.env.USE_SUPABASE === 'true' || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = {
  db: USE_SUPABASE ? supabaseDb : db,
  initializeDatabase,
  USE_SUPABASE
};