// Supabase-based database helper
import { db as supabaseDb } from './supabase';

// Export Supabase database helper
export const db = supabaseDb;

// Supabase is always enabled
export const USE_SUPABASE = true;

// Initialize database with default structure (seed data)
export async function initializeDatabase(): Promise<void> {
  try {
    // Check if products already exist
    const products = await db.get('products').value();
    
    // Seed initial products if database is empty
    if (!products || products.length === 0) {
      const seedProductsData = seedProducts();
      
      // Insert products one by one
      for (const product of seedProductsData) {
        await db.get('products').push(product);
      }
      
      console.log('✅ Database seeded with initial products');
    } else {
      console.log('✅ Database already contains products');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
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
      created_at: new Date().toISOString()
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
      created_at: new Date().toISOString()
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
      created_at: new Date().toISOString()
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
      created_at: new Date().toISOString()
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
      created_at: new Date().toISOString()
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
      created_at: new Date().toISOString()
    }
  ];
}
