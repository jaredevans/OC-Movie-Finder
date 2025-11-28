// test_regal_version.js
// Simple smoke test for Regal API "GettingStarted/Version" endpoint.
//
// Usage:
//   1) Put REGAL_SUB_KEY in .env
//   2) node test_regal_version.js

require('dotenv').config();
const https = require('https');

const SUB_KEY = process.env.REGAL_SUB_KEY;
const HOST = 'api.regmovies.com';
const PATH = '/v1/GettingStarted/Version';

if (!SUB_KEY) {
  console.error('Error: REGAL_SUB_KEY not set in .env');
  process.exit(1);
}

function makeRequest() {
  const options = {
    hostname: HOST,
    path: PATH,
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache',
      'Ocp-Apim-Subscription-Key': SUB_KEY,
      'Accept': 'application/json'
    }
  };

  console.log(`Requesting https://${HOST}${PATH} ...\n`);

  const req = https.request(options, (res) => {
    let body = '';

    console.log(`Status: ${res.statusCode}`);
    console.log('Headers:', res.headers, '\n');

    res.on('data', (chunk) => {
      body += chunk;
    });

    res.on('end', () => {
      const snippet = body.slice(0, 400); // just a preview

      console.log('\nRaw response snippet:\n', snippet, '\n');

      try {
        const json = JSON.parse(body);
        console.log('\nParsed JSON:\n', json);
      } catch (err) {
        console.log('\nCould not parse JSON (maybe plain text):', err.message);
      }
    });
  });

  req.on('error', (err) => {
    console.error('Request error:', err);
  });

  req.end();
}

makeRequest();
