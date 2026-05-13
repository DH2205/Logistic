require('dotenv').config({ path: '.env.local' });

async function testBothEnvironments() {
  console.log('\n🔍 UPS API DIAGNOSTICS\n');
  console.log('═'.repeat(70) + '\n');
  
  const clientId = process.env.UPS_CLIENT_ID;
  const clientSecret = process.env.UPS_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.error('❌ Credentials not found in .env.local\n');
    return;
  }
  
  console.log('✅ Credentials found:');
  console.log(`   Client ID: ${clientId.substring(0, 10)}...`);
  console.log(`   Client Secret: ***${clientSecret.substring(clientSecret.length - 4)}\n`);
  
  const environments = [
    {
      name: 'Production',
      url: 'https://onlinetools.ups.com/api',
      description: 'For real tracking numbers and live shipments'
    },
    {
      name: 'Sandbox (CIE)',
      url: 'https://wwwcie.ups.com/api',
      description: 'For testing with sample tracking numbers'
    }
  ];
  
  console.log('Testing both environments...\n');
  
  for (const env of environments) {
    console.log('─'.repeat(70));
    console.log(`\n🌐 Testing: ${env.name}`);
    console.log(`   URL: ${env.url}`);
    console.log(`   ${env.description}\n`);
    
    try {
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const authUrl = `${env.url}/security/v1/oauth/token`;
      
      console.log(`   📡 Calling: ${authUrl}`);
      
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
        }),
      });
      
      console.log(`   📥 Response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`\n   ✅ ✅ ✅ SUCCESS! This is the correct environment! ✅ ✅ ✅`);
        console.log(`\n   📋 Token received:`);
        console.log(`      Access Token: ${data.access_token.substring(0, 20)}...`);
        console.log(`      Expires In: ${data.expires_in} seconds\n`);
        console.log(`   💡 UPDATE YOUR .env.local WITH THIS URL:`);
        console.log(`      UPS_API_BASE_URL=${env.url}\n`);
        return env.url;
      } else {
        const errorText = await response.text();
        console.log(`   ❌ Failed: ${response.status}`);
        
        if (response.status === 404) {
          console.log(`   💡 This means: Wrong environment for your credentials\n`);
        } else if (response.status === 401 || response.status === 403) {
          console.log(`   💡 This means: Invalid credentials for this environment\n`);
        } else {
          console.log(`   Error: ${errorText.substring(0, 100)}\n`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }
  
  console.log('─'.repeat(70));
  console.log('\n❌ Neither environment worked.\n');
  console.log('💡 Possible issues:');
  console.log('   1. Client ID or Secret is incorrect');
  console.log('   2. Credentials not activated in UPS Developer Portal');
  console.log('   3. Network/firewall blocking requests');
  console.log('   4. UPS API is down (unlikely)\n');
  console.log('🔗 Check your credentials at: https://developer.ups.com/apps\n');
}

testBothEnvironments();
