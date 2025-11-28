// regal_api_smoketest.js
// Simple connectivity test against Regal's "GettingStarted" API.
// Usage: node regal_api_smoketest.js

require('dotenv').config();
const https = require('https');

const SUBSCRIPTION_KEY = process.env.REGAL_SUBSCRIPTION_KEY;
const AUTH_USER = process.env.REGAL_AUTH_USER || 'GettingStarted';

const HOST = 'api.regmovies.com';
const BASE_PATH = '/v1/GettingStarted';

if (!SUBSCRIPTION_KEY) {
  console.error('Error: REGAL_SUBSCRIPTION_KEY is not set in .env');
  process.exit(1);
}

function callRegal(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      path: `${BASE_PATH}${path}`,
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
        'AuthUser': AUTH_USER,
        'Accept': 'application/json',
      },
    };

    console.log(`\n--> GET https://${HOST}${BASE_PATH}${path}`);
    console.log('    AuthUser:', AUTH_USER);

    const req = https.request(options, (res) => {
      let body = '';

      console.log(`    Status: ${res.statusCode}`);

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        const contentType = res.headers['content-type'] || '';
        const isJson = contentType.includes('application/json');

        if (!body) {
          console.log('    (empty response)');
          return resolve({ statusCode: res.statusCode, body: null });
        }

        if (isJson) {
          try {
            const json = JSON.parse(body);
            console.log('    JSON response:', JSON.stringify(json, null, 2));
            resolve({ statusCode: res.statusCode, body: json });
          } catch (e) {
            console.log('    Failed to parse JSON: ', e.message);
            console.log('    Raw body:', body.slice(0, 500));
            reject(e);
          }
        } else {
          console.log('    Non-JSON response, first 500 chars:\n', body.slice(0, 500));
          resolve({ statusCode: res.statusCode, body });
        }
      });
    });

    req.on('error', (err) => {
      console.error('    Request error:', err.message);
      reject(err);
    });

    req.end();
  });
}

async function main() {
  try {
    console.log('Regal API smoketest starting...\n');

    // 1) Echo test – verifies key + AuthUser work at all
    const echoString = encodeURIComponent('OC Movie Finder ping');
    await callRegal(`/Echo/${echoString}`);

    // 2) Version test – confirms connectivity and returns build info
    await callRegal('/Version');

    console.log('\nRegal API smoketest complete.');
    console.log('If both calls returned 200, your keys and AuthUser are working.');
  } catch (err) {
    console.error('\nFatal error in Regal API smoketest:', err);
    process.exit(1);
  }
}

main();
