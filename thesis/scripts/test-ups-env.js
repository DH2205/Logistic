require('dotenv').config({ path: '.env.local' });

console.log('🔍 Checking UPS Environment Variables:\n');
console.log('UPS_CLIENT_ID:', process.env.UPS_CLIENT_ID ? '✅ Set (length: ' + process.env.UPS_CLIENT_ID.length + ')' : '❌ Missing');
console.log('UPS_CLIENT_SECRET:', process.env.UPS_CLIENT_SECRET ? '✅ Set (length: ' + process.env.UPS_CLIENT_SECRET.length + ')' : '❌ Missing');
console.log('UPS_ACCOUNT_NUMBER:', process.env.UPS_ACCOUNT_NUMBER ? '✅ Set (' + process.env.UPS_ACCOUNT_NUMBER + ')' : '❌ Missing');
console.log('UPS_API_BASE_URL:', process.env.UPS_API_BASE_URL || '❌ Missing (will use default)');

console.log('\n' + '='.repeat(50));

if (process.env.UPS_CLIENT_ID && process.env.UPS_CLIENT_SECRET) {
  console.log('\n✅ UPS credentials are configured!');
  console.log('\n📋 Next steps:');
  console.log('1. Run: node scripts/test-ups-api.js (to test authentication)');
  console.log('2. Run: node scripts/test-ups-tracking.js YOUR_TRACKING_NUMBER');
  console.log('3. Restart your Next.js server: npm run dev');
} else {
  console.log('\n❌ UPS credentials are missing!');
  console.log('\n📋 To fix this:');
  console.log('1. Create/edit .env.local file');
  console.log('2. Add these lines:');
  console.log('   UPS_CLIENT_ID=your_client_id');
  console.log('   UPS_CLIENT_SECRET=your_client_secret');
  console.log('   UPS_ACCOUNT_NUMBER=your_account_number');
  console.log('   UPS_API_BASE_URL=https://onlinetools.ups.com/api');
  console.log('3. Save the file');
  console.log('4. Run this script again');
}
