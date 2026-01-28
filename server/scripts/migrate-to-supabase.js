// Migration script to move data from JSON file to Supabase
// Run with: node server/scripts/migrate-to-supabase.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Read JSON database
const dbPath = process.env.DB_FILE || path.join(__dirname, '../data/db.json');

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Error: Database file not found at ${dbPath}`);
  process.exit(1);
}

const jsonData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

async function migrateTable(tableName, data) {
  if (!data || data.length === 0) {
    console.log(`⏭️  Skipping ${tableName} - no data`);
    return;
  }

  console.log(`\n📦 Migrating ${tableName}... (${data.length} records)`);

  try {
    // Clear existing data (optional - comment out if you want to keep existing data)
    // const { error: deleteError } = await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // if (deleteError) console.warn(`Warning clearing ${tableName}:`, deleteError);

    // Insert data in batches
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      const { data: insertedData, error } = await supabase
        .from(tableName)
        .insert(batch)
        .select();

      if (error) {
        console.error(`❌ Error inserting batch ${i / batchSize + 1} into ${tableName}:`, error);
        // Try inserting one by one to identify problematic records
        for (const record of batch) {
          const { error: singleError } = await supabase
            .from(tableName)
            .insert(record);
          if (singleError) {
            console.error(`  Failed record:`, record.id || record.name || 'unknown', singleError.message);
          }
        }
      } else {
        console.log(`  ✅ Inserted batch ${i / batchSize + 1} (${insertedData.length} records)`);
      }
    }

    console.log(`✅ Successfully migrated ${tableName}`);
  } catch (error) {
    console.error(`❌ Error migrating ${tableName}:`, error);
  }
}

async function migrate() {
  console.log('🚀 Starting migration from JSON to Supabase...\n');
  console.log(`📁 Source: ${dbPath}`);
  console.log(`🔗 Supabase: ${supabaseUrl}\n`);

  // Migrate each table
  await migrateTable('users', jsonData.users);
  await migrateTable('products', jsonData.products);
  await migrateTable('locations', jsonData.locations);
  
  // Migrate carts (handle items array)
  if (jsonData.carts && jsonData.carts.length > 0) {
    await migrateTable('carts', jsonData.carts);
  }
  
  // Migrate orders
  if (jsonData.orders && jsonData.orders.length > 0) {
    await migrateTable('orders', jsonData.orders);
  }

  console.log('\n✨ Migration completed!');
  console.log('\n📝 Next steps:');
  console.log('1. Verify data in Supabase dashboard');
  console.log('2. Update your .env file to use Supabase');
  console.log('3. Restart your server');
}

migrate().catch(console.error);
