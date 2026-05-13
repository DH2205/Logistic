/**
 * Import CSV to order_UPS table
 * Usage: node scripts/import-to-order-ups.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse/sync');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const CSV_FILE_PATH = path.join(__dirname, '../../ORDER - Order.csv');
const BATCH_SIZE = 50;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseCSV(filePath) {
  console.log(`📄 Reading: ${filePath}`);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });
  
  console.log(`✅ Parsed ${records.length} records`);
  return records;
}

function transformRecord(csv) {
  const length = parseDecimal(csv['Length (cm)']) || 1.0;
  const width = parseDecimal(csv['Width (cm)']) || 1.0;
  const height = parseDecimal(csv['Height (cm)']) || 1.0;
  const weight = parseDecimal(csv['Total Gross \nWeight (kgs)']) || 1.0;
  const grossWeight = parseDecimal(csv['Total Billable \nWeight (kgs)']) || weight;
  
  return {
    order_id: csv['House Bill No.'] || `UPS-${Date.now()}`,
    user_id: null,
    unique_id_user: null,
    
    sender_name: csv['Company_sender'] || csv['Sender'] || '',
    sender_phone: csv['Phone_sender'] || '',
    sender_email: csv['Email_sender'] || '',
    sender_address: csv['Address_sender'] || csv['Pick-up Address'] || '',
    
    receiver_name: csv['Company_receiver'] || csv['Receiver'] || 'Unknown',
    receiver_address: csv['Address_receiver'] || '',
    
    length,
    width,
    height,
    weight,
    gross_weight: grossWeight,
    
    from_location: extractCountry(csv['Country_sender']) || csv['Country'] || 'Vietnam',
    to_location: extractCountry(csv['Country_receiver']) || csv['Country'] || 'Unknown',
    
    status: mapStatus(csv['Status']),
    delivery_status: mapStatus(csv['Status']),
    tracking_number: csv['Tracking Number'] || `TRK${Date.now()}`,
    carrier: extractCarrier(csv['Account'] || csv['Brand']) || 'UPS',
    
    package_name: csv['Commodities'] || `Package for ${csv['Receiver']}`,
    measurements: `${length}x${width}x${height} cm`,
    customer_name: csv['Sender'] || '',
    sender: csv['Sender'] || '',
    origin: csv['Country_sender'] || csv['Country'] || '',
    destination: csv['Country_receiver'] || csv['Country'] || '',
    
    submission_time: parseDate(csv['Date FPU']) || new Date().toISOString(),
    created_at: parseDate(csv['Date FPU']) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    
    extended_data: {
      house_bill_no: csv['House Bill No.'],
      account: csv['Account'],
      brand: csv['Brand'],
      brand_service: csv["Brand's Service"],
      salesperson: csv['Salesperson'],
      pic: csv['PIC'],
      commodities: csv['Commodities'],
      package_type: csv['Package  Type'],
      packages_quantity: parseNumber(csv['Packages  Quantity']),
      mode: csv['Mode'],
      pickup_date: parseDate(csv['Pickup \nDate']),
      export_date: parseDate(csv['Export \nDate']),
      arrival_date: parseDate(csv['Arrival \nDate']),
      postal_code_sender: csv['Postal Code_sender'],
      postal_code_receiver: csv['Postal Code_receiver'],
    }
  };
}

function parseDecimal(str) {
  if (!str || str.trim() === '') return null;
  const num = parseFloat(str.replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

function parseNumber(str) {
  if (!str || str.trim() === '') return null;
  const num = parseInt(str.replace(/,/g, ''), 10);
  return isNaN(num) ? null : num;
}

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
    return isNaN(date.getTime()) ? null : date.toISOString();
  } catch {
    return null;
  }
}

function extractCountry(str) {
  if (!str) return null;
  const match = str.match(/[A-Z]{2}-(.+)/);
  return match ? match[1].trim() : str.trim();
}

function extractCarrier(str) {
  if (!str) return 'UPS';
  if (str.includes('UPS')) return 'UPS';
  if (str.includes('FEDEX') || str.includes('FDX')) return 'FedEx';
  if (str.includes('DHL')) return 'DHL';
  return 'UPS';
}

function mapStatus(status) {
  if (!status) return 'pending';
  const s = status.toLowerCase();
  if (s.includes('delivered')) return 'delivered';
  if (s.includes('transit')) return 'in_transit';
  if (s.includes('cancelled')) return 'cancelled';
  return 'pending';
}

async function importRecords(records) {
  console.log(`\n📦 Importing ${records.length} records to order_ups table...\n`);
  
  let imported = 0;
  let failed = 0;
  let skipped = 0;
  const errors = [];
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);
    
    console.log(`📊 Batch ${batchNum}/${totalBatches} (${batch.length} records)...`);
    
    try {
      const transformed = batch.map(transformRecord);
      
      const { data, error } = await supabase
        .from('order_ups')
        .insert(transformed);
      
      if (error) {
        if (error.code === '23505') {
          console.log(`   ⚠️  Skipped ${batch.length} duplicates`);
          skipped += batch.length;
        } else {
          console.error(`   ❌ Error: ${error.message}`);
          failed += batch.length;
          errors.push({ batch: batchNum, error: error.message });
        }
      } else {
        console.log(`   ✅ Imported ${batch.length} records`);
        imported += batch.length;
      }
    } catch (err) {
      console.error(`   ❌ Exception: ${err.message}`);
      failed += batch.length;
      errors.push({ batch: batchNum, error: err.message });
    }
    
    const progress = ((i + batch.length) / records.length * 100).toFixed(1);
    console.log(`   Progress: ${progress}%\n`);
  }
  
  console.log('='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Imported: ${imported}`);
  console.log(`⚠️  Skipped:  ${skipped}`);
  console.log(`❌ Failed:   ${failed}`);
  console.log(`📝 Total:    ${records.length}`);
  console.log('='.repeat(60));
  
  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.slice(0, 5).forEach(e => {
      console.log(`   Batch ${e.batch}: ${e.error}`);
    });
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 CSV TO order_ups TABLE IMPORT');
  console.log('='.repeat(60) + '\n');
  
  try {
    const records = parseCSV(CSV_FILE_PATH);
    if (records.length === 0) {
      console.log('⚠️  No records to import');
      return;
    }
    
    await importRecords(records);
    
    console.log('\n✅ Import completed!');
    console.log('\n📊 Verify:');
    console.log('   SELECT COUNT(*) FROM order_ups;\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
