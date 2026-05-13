/**
 * Import data from JSON file into Supabase database
 * 
 * Usage:
 * 1. Place your database.json file in the root directory
 * 2. Run: npx tsx scripts/import-data.ts
 * 
 * Or use Node.js:
 * node -r ts-node/register scripts/import-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface DatabaseData {
  users?: any[];
  products?: any[];
  orders?: any[];
  locations?: any[];
  carts?: any[];
}

// Helper to convert createdAt to created_at
function convertFieldNames(obj: any): any {
  const converted: any = { ...obj };
  
  // Convert createdAt to created_at
  if (converted.createdAt) {
    converted.created_at = converted.createdAt;
    delete converted.createdAt;
  }
  
  // Convert updatedAt to updated_at
  if (converted.updatedAt) {
    converted.updated_at = converted.updatedAt;
    delete converted.updatedAt;
  }
  
  // Convert submissionTime to submission_time
  if (converted.submissionTime) {
    converted.submission_time = converted.submissionTime;
    delete converted.submissionTime;
  }
  
  // Convert orderID to order_id
  if (converted.orderID) {
    converted.order_id = converted.orderID;
    delete converted.orderID;
  }
  
  // Convert userId to user_id
  if (converted.userId) {
    converted.user_id = converted.userId;
    delete converted.userId;
  }
  
  // Convert packageName to package_name
  if (converted.packageName) {
    converted.package_name = converted.packageName;
    delete converted.packageName;
  }
  
  // Convert customerName to customer_name
  if (converted.customerName) {
    converted.customer_name = converted.customerName;
    delete converted.customerName;
  }
  
  // Convert receiverName to receiver_name
  if (converted.receiverName) {
    converted.receiver_name = converted.receiverName;
    delete converted.receiverName;
  }
  
  // Convert deliveryStatus to delivery_status
  if (converted.deliveryStatus) {
    converted.delivery_status = converted.deliveryStatus;
    delete converted.deliveryStatus;
  }
  
  // Convert trackingNumber to tracking_number
  if (converted.trackingNumber) {
    converted.tracking_number = converted.trackingNumber;
    delete converted.trackingNumber;
  }
  
  return converted;
}

async function importData() {
  try {
    // Read the JSON file
    const jsonPath = path.join(process.cwd(), 'database.json');
    
    if (!fs.existsSync(jsonPath)) {
      console.error(`❌ File not found: ${jsonPath}`);
      console.error('Please place database.json in the root directory of your project');
      process.exit(1);
    }
    
    const fileContent = fs.readFileSync(jsonPath, 'utf-8');
    const data: DatabaseData = JSON.parse(fileContent);
    
    console.log('📦 Starting data import...\n');
    
    // Import Users
    if (data.users && data.users.length > 0) {
      console.log(`📝 Importing ${data.users.length} users...`);
      const users = data.users.map(convertFieldNames);
      
      // Check for existing users to avoid duplicates
      for (const user of users) {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single();
        
        if (!existing) {
          const { error } = await supabase
            .from('users')
            .insert(user);
          
          if (error) {
            console.error(`  ❌ Error importing user ${user.email}:`, error.message);
          } else {
            console.log(`  ✅ Imported user: ${user.email}`);
          }
        } else {
          console.log(`  ⏭️  User already exists: ${user.email}`);
        }
      }
      console.log('');
    }
    
    // Import Products
    if (data.products && data.products.length > 0) {
      console.log(`📦 Importing ${data.products.length} products...`);
      const products = data.products.map(convertFieldNames);
      
      for (const product of products) {
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('id', product.id)
          .single();
        
        if (!existing) {
          const { error } = await supabase
            .from('products')
            .insert(product);
          
          if (error) {
            console.error(`  ❌ Error importing product ${product.name}:`, error.message);
          } else {
            console.log(`  ✅ Imported product: ${product.name}`);
          }
        } else {
          console.log(`  ⏭️  Product already exists: ${product.name}`);
        }
      }
      console.log('');
    }
    
    // Import Locations (Airports)
    if (data.locations && data.locations.length > 0) {
      console.log(`📍 Importing ${data.locations.length} locations...`);
      const locations = data.locations.map(convertFieldNames);
      
      for (const location of locations) {
        const { data: existing } = await supabase
          .from('locations')
          .select('id')
          .eq('id', location.id)
          .single();
        
        if (!existing) {
          const { error } = await supabase
            .from('locations')
            .insert(location);
          
          if (error) {
            console.error(`  ❌ Error importing location ${location.name}:`, error.message);
          } else {
            console.log(`  ✅ Imported location: ${location.name}`);
          }
        } else {
          console.log(`  ⏭️  Location already exists: ${location.name}`);
        }
      }
      console.log('');
    }
    
    // Import Orders
    if (data.orders && data.orders.length > 0) {
      console.log(`📋 Importing ${data.orders.length} orders...`);
      const orders = data.orders.map(convertFieldNames);
      
      for (const order of orders) {
        const { data: existing } = await supabase
          .from('orders')
          .select('id')
          .eq('order_id', order.order_id)
          .single();
        
        if (!existing) {
          const { error } = await supabase
            .from('orders')
            .insert(order);
          
          if (error) {
            console.error(`  ❌ Error importing order ${order.order_id}:`, error.message);
          } else {
            console.log(`  ✅ Imported order: ${order.order_id}`);
          }
        } else {
          console.log(`  ⏭️  Order already exists: ${order.order_id}`);
        }
      }
      console.log('');
    }
    
    console.log('✅ Data import completed!');
    
  } catch (error: any) {
    console.error('❌ Error during import:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the import
importData();
