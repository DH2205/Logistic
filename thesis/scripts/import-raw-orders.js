/**
 * CSV Import Script for Raw Orders
 * 
 * This script imports data from "ORDER - Order.csv" into the raw_orders table
 * 
 * Usage:
 *   node scripts/import-raw-orders.js
 * 
 * Features:
 *   - Batch processing (100 records at a time)
 *   - Progress tracking
 *   - Error handling and logging
 *   - Duplicate detection
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const CSV_FILE_PATH = path.join(__dirname, '../../ORDER - Order.csv');
const BATCH_SIZE = 100; // Insert 100 records at a time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Supabase credentials not found in .env.local');
  console.error('   Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Parse CSV file
 */
function parseCSV(filePath) {
  console.log(`📄 Reading CSV file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }
  
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n');
  
  // Parse header
  const header = parseCSVLine(lines[0]);
  console.log(`✅ Found ${header.length} columns`);
  console.log(`✅ Found ${lines.length - 1} data rows`);
  
  // Parse data rows
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue; // Skip empty lines
    
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

/**
 * Parse a CSV line (handles quoted values with commas)
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current);
  
  return result;
}

/**
 * Transform CSV record to database record
 */
function transformRecord(csvRecord) {
  return {
    house_bill_no: csvRecord['House Bill No.'] || null,
    tracking_number: csvRecord['Tracking Number'] || null,
    account: csvRecord['Account'] || null,
    classification: csvRecord['Classification'] || null,
    status: csvRecord['Status'] || null,
    method: csvRecord['Method'] || null,
    country: csvRecord['Country'] || null,
    hub: csvRecord['Hub'] || null,
    brand: csvRecord['Brand'] || null,
    brand_service: csvRecord["Brand's Service"] || null,
    vnex_service: csvRecord["VNEX 's \nService"] || null,
    
    // Dates
    time_fpu: csvRecord['Time FPU'] || null,
    date_fpu: parseDate(csvRecord['Date FPU']),
    pickup_date: parseDate(csvRecord['Pickup \nDate']),
    terminal_entry_date: parseDate(csvRecord['Terminal Entry Date']),
    origin_scan_date: parseDate(csvRecord['Origin Scan Date']),
    export_date: parseDate(csvRecord['Export \nDate']),
    arrival_date: parseDate(csvRecord['Arrival \nDate']),
    
    // Personnel
    salesperson: csvRecord['Salesperson'] || null,
    pic: csvRecord['PIC'] || null,
    
    // Parties
    sender: csvRecord['Sender'] || null,
    receiver: csvRecord['Receiver'] || null,
    pickup_address: csvRecord['Pick-up Address'] || null,
    
    // Package Information
    commodities: csvRecord['Commodities'] || null,
    package_type: csvRecord['Package  Type'] || null,
    packages_quantity: parseNumber(csvRecord['Packages  Quantity']),
    length_cm: parseDecimal(csvRecord['Length (cm)']),
    width_cm: parseDecimal(csvRecord['Width (cm)']),
    height_cm: parseDecimal(csvRecord['Height (cm)']),
    total_dimensional_weight_kgs: parseDecimal(csvRecord['Total Dimensional \nWeight (kgs)']),
    total_gross_weight_kgs: parseDecimal(csvRecord['Total Gross \nWeight (kgs)']),
    total_billable_weight_kgs: parseDecimal(csvRecord['Total Billable \nWeight (kgs)']),
    total_billable_reweight_kgs: parseDecimal(csvRecord['Total Billable Reweight (kgs)']),
    
    // Reference
    reference_no: csvRecord['Reference No.'] || null,
    declaration_type: csvRecord['Declaration Type'] || null,
    vat: parseBoolean(csvRecord['VAT']),
    
    // Status fields
    case_status: csvRecord['Case'] || null,
    label_status: csvRecord['Label'] || null,
    package_status: csvRecord['Package'] || null,
    delivered: csvRecord['Delivered'] || null,
    status_location: csvRecord['Status Location'] || null,
    status_delivery: csvRecord['Status Delivery'] || null,
    
    // Additional fields
    full_address: csvRecord['Full Address'] || null,
    phone_number: csvRecord['Phone Number'] || null,
    contact_name: csvRecord['Contact Name'] || null,
    province_city: csvRecord['Province/City'] || null,
    ward: csvRecord['Ward'] || null,
    
    // Sender details
    company_sender: csvRecord['Company_sender'] || null,
    contact_name_sender: csvRecord['Contact_name_sender'] || null,
    phone_sender: csvRecord['Phone_sender'] || null,
    email_sender: csvRecord['Email_sender'] || null,
    address_sender: csvRecord['Address_sender'] || null,
    province_sender: csvRecord['Province_sender'] || null,
    city_sender: csvRecord['City_sender'] || null,
    postal_code_sender: csvRecord['Postal Code_sender'] || null,
    country_sender: csvRecord['Country_sender'] || null,
    
    // Receiver details
    company_receiver: csvRecord['Company_receiver'] || null,
    contact_name_receiver: csvRecord['Contact_name_receiver'] || null,
    phone_receiver: csvRecord['Phone_receiver'] || null,
    email_receiver: csvRecord['Email_receiver'] || null,
    address_receiver: csvRecord['Address_receiver'] || null,
    province_receiver: csvRecord['Province_receiver'] || null,
    city_receiver: csvRecord['City_receiver'] || null,
    postal_code_receiver: csvRecord['Postal Code_receiver'] || null,
    country_receiver: csvRecord['Country_receiver'] || null,
    
    // Mode
    mode: csvRecord['Mode'] || null,
    pick_up_drop_off: csvRecord['Pick_Up_Drop_Off'] || null,
    
    // Costs
    vnex_internal_cost: parseDecimal(csvRecord['VNEX Internal Cost']),
    internal_description: csvRecord['Internal Description'] || null,
    vnex_additional_service_fee: parseDecimal(csvRecord['VNEX Additional Service Fee']),
    additional_description: csvRecord['Additional Description'] || null,
    
    // History
    history: csvRecord['History'] || null,
    name: csvRecord['Name'] || null,
    changed_columns: csvRecord['ChangedColumns'] || null,
    
    // Metadata
    record_id: csvRecord['ID'] || null,
  };
}

/**
 * Helper functions for parsing
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  
  // Try different date formats
  const formats = [
    /^\d{4}-\w{3}-\d{2}$/, // 2023-Jul-04
    /^\d{4}-\d{2}-\d{2}$/, // 2023-07-04
  ];
  
  // Convert month names to numbers
  const monthMap = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  
  // Convert 2023-Jul-04 to 2023-07-04
  dateStr = dateStr.replace(/(\d{4})-(\w{3})-(\d{2})/, (match, year, month, day) => {
    return `${year}-${monthMap[month] || month}-${day}`;
  });
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
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
  if (upper === 'TRUE' || upper === 'YES' || upper === '1') return true;
  if (upper === 'FALSE' || upper === 'NO' || upper === '0') return false;
  return null;
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
      const transformedRecords = batch.map(transformRecord);
      
      const { data, error } = await supabase
        .from('raw_orders')
        .insert(transformedRecords);
      
      if (error) {
        if (error.code === '23505') {
          // Duplicate key error
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
    
    // Progress indicator
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
    errors.forEach(e => {
      console.log(`   Batch ${e.batch}: ${e.error}`);
    });
  }
  
  return { imported, failed, skipped };
}

/**
 * Main function
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 RAW ORDERS CSV IMPORT SCRIPT');
  console.log('='.repeat(60) + '\n');
  
  try {
    // Parse CSV
    const { records } = parseCSV(CSV_FILE_PATH);
    
    if (records.length === 0) {
      console.log('⚠️  No records to import');
      return;
    }
    
    // Import records
    await importRecords(records);
    
    console.log('\n✅ Import completed!\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
