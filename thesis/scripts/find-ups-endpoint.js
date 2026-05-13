require('dotenv').config({ path: '.env.local' });

async function findCorrectEndpoint() {
  console.log('\n🔍 FINDING CORRECT UPS OAUTH ENDPOINT\n');
  console.log('═'.repeat(70) + '\n');
  
  const clientId = process.env.UPS_CLIENT_ID;
  const clientSecret = process.env.UPS_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.error('❌ Credentials not found\n');
    return;
  }
  
  console.log('✅ Credentials loaded\n');
  
  // Different possible base URLs and endpoints
  const testConfigs = [
    // Production endpoints
    { 
      env: 'Production', 
      base: 'https://onlinetools.ups.com',
      paths: [
        '/security/v1/oauth/token',
        '/api/security/v1/oauth/token',
        '/oauth/token',
        '/api/oauth/token',
        '/security/oauth/token'
      ]
    },
    // Sandbox endpoints
    { 
      env: 'Sandbox', 
      base: 'https://wwwcie.ups.com',
      paths: [
        '/security/v1/oauth/token',
        '/api/security/v1/oauth/token',
        '/oauth/token',
        '/api/oauth/token',
        '/security/oauth/token'
      ]
    },
    // Alternative production
    { 
      env: 'Production Alt', 
      base: 'https://apis.ups.com',
      paths: [
        '/security/v1/oauth/token',
        '/oauth/token',
        '/api/security/v1/oauth/token'
      ]
    },
    // Alternative sandbox
    { 
      env: 'Sandbox Alt', 
      base: 'https://wwwcie.ups.com/api',
      paths: [
        '/security/v1/oauth/token',
        '/oauth/token'
      ]
    }
  ];
  
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  let foundWorking = false;
  
  for (const config of testConfigs) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🌐 Testing: ${config.env}`);
    console.log(`   Base: ${config.base}`);
    console.log('='.repeat(70) + '\n');
    
    for (const path of config.paths) {
      const fullUrl = `${config.base}${path}`;
      
      try {
        console.log(`📡 Trying: ${fullUrl}`);
        
        const response = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
          }),
        });
        
        console.log(`   Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('\n   🎉🎉🎉 SUCCESS! FOUND THE CORRECT ENDPOINT! 🎉🎉🎉\n');
          console.log(`   ✅ Working Environment: ${config.env}`);
          console.log(`   ✅ Full URL: ${fullUrl}`);
          console.log(`   ✅ Access Token: ${data.access_token.substring(0, 20)}...`);
          console.log(`   ✅ Expires In: ${data.expires_in} seconds\n`);
          console.log('   📋 ADD THESE TO YOUR .env.local:\n');
          
          // Determine the base URL for tracking API
          let apiBaseUrl;
          if (path.startsWith('/api/')) {
            apiBaseUrl = config.base;
          } else {
            apiBaseUrl = fullUrl.replace(path, '');
          }
          
          console.log(`   UPS_API_BASE_URL=${apiBaseUrl}`);
          console.log(`   UPS_OAUTH_ENDPOINT=${fullUrl}\n`);
          
          foundWorking = true;
          return { base: apiBaseUrl, oauth: fullUrl };
        } else {
          if (response.status === 404) {
            console.log(`   ❌ 404 - Endpoint doesn't exist`);
          } else if (response.status === 401) {
            console.log(`   ⚠️  401 - Endpoint exists but credentials invalid`);
          } else if (response.status === 403) {
            console.log(`   ⚠️  403 - Endpoint exists but access forbidden`);
          } else {
            const text = await response.text();
            console.log(`   ❌ ${response.status} - ${text.substring(0, 100)}`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
      console.log('');
    }
  }
  
  if (!foundWorking) {
    console.log('\n' + '='.repeat(70));
    console.log('❌ COULD NOT FIND WORKING ENDPOINT\n');
    console.log('💡 This usually means:\n');
    console.log('1. ❌ Invalid Client ID or Secret');
    console.log('   → Check at: https://developer.ups.com/apps');
    console.log('   → Make sure you copied them correctly (no extra spaces)');
    console.log('   → Try regenerating credentials\n');
    console.log('2. ❌ Credentials not activated');
    console.log('   → In UPS Developer Portal, make sure app is activated');
    console.log('   → Some credentials need approval from UPS\n');
    console.log('3. ❌ Wrong type of credentials');
    console.log('   → Make sure they are OAuth credentials, not API keys');
    console.log('   → Should have Client ID and Client Secret\n');
    console.log('4. ⚠️  Network/Firewall issue');
    console.log('   → Try from different network');
    console.log('   → Check if corporate firewall blocks UPS\n');
    console.log('5. 🔍 UPS API structure changed');
    console.log('   → Check latest docs: https://developer.ups.com/api/reference\n');
    console.log('='.repeat(70) + '\n');
    
    console.log('🔧 NEXT STEPS:\n');
    console.log('1. Login to: https://developer.ups.com/apps');
    console.log('2. Click on your app');
    console.log('3. Verify:');
    console.log('   • App status is "Active"');
    console.log('   • Tracking API is enabled');
    console.log('   • OAuth is configured');
    console.log('4. Copy Client ID and Secret again (carefully!)');
    console.log('5. Update .env.local with correct values\n');
  }
}

findCorrectEndpoint();
