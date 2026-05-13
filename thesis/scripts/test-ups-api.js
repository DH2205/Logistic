require('dotenv').config({ path: '.env.local' });

async function testUPSAuth() {
  console.log('🔐 Testing UPS Authentication...\n');
  
  const clientId = process.env.UPS_CLIENT_ID;
  const clientSecret = process.env.UPS_CLIENT_SECRET;
  const baseUrl = process.env.UPS_API_BASE_URL || 'https://onlinetools.ups.com/api';
  
  if (!clientId || !clientSecret) {
    console.error('❌ UPS credentials not found in environment variables');
    console.error('\n📋 Run this first: node scripts/test-ups-env.js');
    return;
  }
  
  console.log('📋 Configuration:');
  console.log('   Base URL:', baseUrl);
  console.log('   Client ID:', clientId.substring(0, 10) + '...');
  console.log('   Client Secret:', '***' + clientSecret.substring(clientSecret.length - 4));
  console.log('');
  
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    console.log('📡 Requesting access token from UPS...');
    console.log('   Endpoint:', `${baseUrl}/security/v1/oauth/token`);
    console.log('');
    
    const response = await fetch(`${baseUrl}/security/v1/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
      }),
    });
    
    console.log('📥 Response Status:', response.status, response.statusText);
    console.log('');
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Authentication failed!');
      console.error('   Status:', response.status, response.statusText);
      console.error('   Response:', errorText);
      console.error('');
      console.error('💡 Common issues:');
      console.error('   • Wrong Client ID or Secret');
      console.error('   • Using sandbox credentials with production URL (or vice versa)');
      console.error('   • Credentials not activated in UPS Developer Portal');
      console.error('');
      console.error('🔗 Check your app at: https://developer.ups.com/apps');
      return;
    }
    
    const data = await response.json();
    
    console.log('✅ Authentication successful!');
    console.log('');
    console.log('📋 Token Details:');
    console.log('   Access Token:', data.access_token.substring(0, 20) + '...');
    console.log('   Token Type:', data.token_type);
    console.log('   Expires In:', data.expires_in, 'seconds (' + (data.expires_in / 3600).toFixed(1) + ' hours)');
    console.log('');
    console.log('🎉 UPS API is ready to use!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Test tracking: node scripts/test-ups-tracking.js YOUR_TRACKING_NUMBER');
    console.log('2. Restart your app: npm run dev');
    console.log('3. Add tracking numbers to your orders');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('💡 This might be a network issue. Check your internet connection.');
  }
}

testUPSAuth();
