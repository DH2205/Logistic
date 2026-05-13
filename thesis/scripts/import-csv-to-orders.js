/**
 * CSV Import Script - Maps to Existing Orders Table
 * 
 * This script imports CSV data into the existing orders table structure
 * Main fields go to their respective columns
 * Additional CSV fields stored in extended_data JSONB column
 * 
 * Usage:
 *   node scripts/import-csv-to-orders.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const CSV_FILE_PATH = path.join(__dirname, '../../ORDER - Order.csv');
const BATCH_SIZE = 50; // Smaller batch for complex transformations
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000'; // Placeholder user_id

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Supabase credentials not found');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Parse CSV file (same as before)
 */
function parseCSV(filePath) {
  console.log(`📄 Reading CSV file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }
  
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n');
  
  const header = parseCSVLine(lines[0]);
  console.log(`✅ Found ${header.length} columns`);
  console.log(`✅ Found ${lines.length - 1} data rows`);
  
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = parseCSVLine(lines[i]);
    if (values.length === header.length) {
      const record = {};
      header.forEach((col, index) => {
        record[col] = values[index];
      });
      records.push(record);
    }
  }
  
  console.log(`✅ Parsed ${records.length} valid records`);
  return { header, records };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

/**
 * Transform CSV record to Orders table format
 */
function transformToOrdersFormat(csvRecord) {
  // Parse dimensions and weights
  const length = parseDecimal(csvRecord['Length (cm)']) || 1.0;
  const width = parseDecimal(csvRecord['Width (cm)']) || 1.0;
  const height = parseDecimal(csvRecord['Height (cm)']) || 1.0;
  const weight = parseDecimal(csvRecord['Total Gross \nWeight (kgs)']) || 1.0;
  const grossWeight = parseDecimal(csvRecord['Total Billable \nWeight (kgs)']) || weight;
  
  // Extract country from location
  const fromCountry = extractCountry(csvRecord['Country_sender']) || csvRecord['Country'] || 'Vietnam';
  const toCountry = extractCountry(csvRecord['Country_receiver']) || csvRecord['Country'] || 'Unknown';
  
  // Determine carrier from account or brand
  const carrier = extractCarrier(csvRecord['Account'] || csvRecord['Brand'] || '');
  
  // Build main order record
  const orderRecord = {
    order_id: csvRecord['House Bill No.'] || generateOrderId(),
    user_id: DEFAULT_USER_ID, // You may want to map this to actual users
    unique_id_user: DEFAULT_USER_ID,
    
    // Sender information
    sender_name: csvRecord['Company_sender'] || csvRecord['Sender'] || 'Unknown Sender',
    sender_phone: csvRecord['Phone_sender'] || '',
    sender_email: csvRecord['Email_sender'] || '',
    sender_address: csvRecord['Address_sender'] || csvRecord['Pick-up Address'] || '',
    
    // Receiver information
    receiver_name: csvRecord['Company_receiver'] || csvRecord['Receiver'] || 'Unknown Receiver',
    receiver_address: csvRecord['Address_receiver'] || '',
    
    // Package dimensions
    length,
    width,
    height,
    weight,
    gross_weight: grossWeight,
    
    // Shipping information
    from_location: fromCountry,
    to_location: toCountry,
    
    // Status and tracking
    status: mapStatus(csvRecord['Status']),
    delivery_status: mapStatus(csvRecord['Status']),
    tracking_number: csvRecord['Tracking Number'] || generateTrackingNumber(),
    carrier: carrier,
    
    // Package info
    package_name: csvRecord['Commodities'] || `Package for ${csvRecord['Receiver'] || 'Unknown'}`,
    measurements: `${length}x${width}x${height} cm`,
    customer_name: csvRecord['Sender'] || csvRecord['Company_sender'] || '',
    
    // Timestamps
    submission_time: parseDate(csvRecord['Date FPU']) || new Date().toISOString(),
    created_at: parseDate(csvRecord['Date FPU']) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    
    // Extended data - all additional CSV fields
    extended_data: buildExtendedData(csvRecord)
  };
  
  return orderRecord;
}

/**
 * Build extended_data JSONB with additional CSV fields
 */
function buildExtendedData(csvRecord) {
  return {
    // Core identifiers
    house_bill_no: csvRecord['House Bill No.'] || null,
    account: csvRecord['Account'] || null,
    classification: csvRecord['Classification'] || null,
    
    // Shipping details
    hub: csvRecord['Hub'] || null,
    brand: csvRecord['Brand'] || null,
    brand_service: csvRecord["Brand's Service"] || null,
    vnex_service: csvRecord["VNEX 's \nService"] || null,
    method: csvRecord['Method'] || null, // Export/Import
    
    // Personnel
    salesperson: csvRecord['Salesperson'] || null,
    pic: csvRecord['PIC'] || null,
    
    // Package details
    commodities: csvRecord['Commodities'] || null,
    package_type: csvRecord['Package  Type'] || null,
    packages_quantity: parseNumber(csvRecord['Packages  Quantity']),
    total_dimensional_weight_kgs: parseDecimal(csvRecord['Total Dimensional \nWeight (kgs)']),
    total_billable_reweight_kgs: parseDecimal(csvRecord['Total Billable Reweight (kgs)']),
    
    // Reference and declaration
    reference_no: csvRecord['Reference No.'] || null,
    declaration_type: csvRecord['Declaration Type'] || null,
    vat: parseBoolean(csvRecord['VAT']),
    
    // Mode and type
    mode: csvRecord['Mode'] || null, // B2B, B2C
    pick_up_drop_off: csvRecord['Pick_Up_Drop_Off'] || null,
    
    // Dates
    pickup_date: parseDate(csvRecord['Pickup \nDate']),
    terminal_entry_date: parseDate(csvRecord['Terminal Entry Date']),
    origin_scan_date: parseDate(csvRecord['Origin Scan Date']),
    export_date: parseDate(csvRecord['Export \nDate']),
    arrival_date: parseDate(csvRecord['Arrival \nDate']),
    
    // Address details
    province_sender: csvRecord['Province_sender'] || null,
    city_sender: csvRecord['City_sender'] || null,
    postal_code_sender: csvRecord['Postal Code_sender'] || null,
    country_sender: csvRecord['Country_sender'] || null,
    
    province_receiver: csvRecord['Province_receiver'] || null,
    city_receiver: csvRecord['City_receiver'] || null,
    postal_code_receiver: csvRecord['Postal Code_receiver'] || null,
    country_receiver: csvRecord['Country_receiver'] || null,
    
    // Costs
    vnex_internal_cost: parseDecimal(csvRecord['VNEX Internal Cost']),
    vnex_additional_service_fee: parseDecimal(csvRecord['VNEX Additional Service Fee']),
    internal_description: csvRecord['Internal Description'] || null,
    additional_description: csvRecord['Additional Description'] || null,
    
    // Additional fields
    hab_tracking_number: csvRecord['HAB_Tracking_Number'] || null,
    full_address: csvRecord['Full Address'] || null,
    contact_name: csvRecord['Contact Name'] || null,
    phone_number: csvRecord['Phone Number'] || null,
    province_city: csvRecord['Province/City'] || null,
    ward: csvRecord['Ward'] || null,
    
    // Metadata
    history: csvRecord['History'] || null,
    changed_by: csvRecord['Name'] || null,
  };
}

/**
 * Helper functions
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  
  const monthMap = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  
  dateStr = dateStr.replace(/(\d{4})-(\w{3})-(\d{2})/, (match, year, month, day) => {
    return `${year}-${monthMap[month] || month}-${day}`;
  });
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

function parseNumber(str) {
  if (!str || str.trim() === '') return null;
  const num = parseInt(str.replace(/,/g, ''), 10);
  return isNaN(num) ? null : num;
}

function parseDecimal(str) {
  if (!str || str.trim() === '') return null;
  const num = parseFloat(str.replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

function parseBoolean(str) {
  if (!str) return null;
  const upper = str.toUpperCase().trim();
  return upper === 'TRUE' || upper === 'YES' || upper === '1';
}

function extractCountry(locationStr) {
  if (!locationStr) return null;
  // Extract country from format like "US-United States" or "VN-Vietnam"
  const match = locationStr.match(/[A-Z]{2}-(.+)/);
  return match ? match[1].trim() : locationStr.trim();
}

function extractCarrier(accountStr) {
  if (!accountStr) return null;
  if (accountStr.includes('UPS')) return 'UPS';
  if (accountStr.includes('FEDEX') || accountStr.includes('FDX')) return 'FedEx';
  if (accountStr.includes('DHL')) return 'DHL';
  return 'Other';
}

function mapStatus(statusStr) {
  if (!statusStr) return 'pending';
  const status = statusStr.toLowerCase();
  if (status.includes('delivered')) return 'delivered';
  if (status.includes('transit')) return 'in_transit';
  if (status.includes('cancelled')) return 'cancelled';
  return 'pending';
}

function generateOrderId() {
  return 'ORD-' + Date.now().toString(36).toUpperCase();
}

function generateTrackingNumber() {
  return 'TRK' + Date.now();
}

/**
 * Import records in batches
 */
async function importRecords(records) {
  console.log(`\n📦 Starting import of ${records.length} records...`);
  console.log(`   Batch size: ${BATCH_SIZE} records per batch\n`);
  
  let imported = 0;
  let failed = 0;
  let skipped = 0;
  const errors = [];
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);
    
    console.log(`📊 Processing batch ${batchNum}/${totalBatches} (${batch.length} records)...`);
    
    try {
      const transformedRecords = batch.map(transformToOrdersFormat);
      
      const { data, error } = await supabase
        .from('orders')
        .insert(transformedRecords);
      
      if (error) {
        if (error.code === '23505') {
          console.log(`   ⚠️  Skipped ${batch.length} duplicate records`);
          skipped += batch.length;
        } else {
          console.error(`   ❌ Error in batch ${batchNum}:`, error.message);
          failed += batch.length;
          errors.push({ batch: batchNum, error: error.message });
        }
      } else {
        console.log(`   ✅ Imported ${batch.length} records successfully`);
        imported += batch.length;
      }
    } catch (err) {
      console.error(`   ❌ Exception in batch ${batchNum}:`, err.message);
      failed += batch.length;
      errors.push({ batch: batchNum, error: err.message });
    }
    
    const progress = ((i + batch.length) / records.length * 100).toFixed(1);
    console.log(`   Progress: ${progress}%\n`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successfully imported: ${imported} records`);
  console.log(`⚠️  Skipped (duplicates):  ${skipped} records`);
  console.log(`❌ Failed:                ${failed} records`);
  console.log(`📝 Total processed:       ${records.length} records`);
  console.log('='.repeat(60));
  
  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.slice(0, 10).forEach(e => {
      console.log(`   Batch ${e.batch}: ${e.error}`);
    });
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more errors`);
    }
  }
  
  return { imported, failed, skipped };
}

/**
 * Main function
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 CSV TO ORDERS TABLE IMPORT SCRIPT');
  console.log('='.repeat(60) + '\n');
  
  try {
    // Parse CSV
    const { records } = parseCSV(CSV_FILE_PATH);
    
    if (records.length === 0) {
      console.log('⚠️  No records to import');
      return;
    }
    
    console.log('\n💡 Mapping CSV fields to orders table format...');
    console.log('   Main fields → orders table columns');
    console.log('   Extra fields → extended_data JSONB column\n');
    
    // Import records
    await importRecords(records);
    
    console.log('\n✅ Import completed!');
    console.log('\n📊 Query your data:');
    console.log('   SELECT * FROM orders_with_csv_data LIMIT 10;\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
