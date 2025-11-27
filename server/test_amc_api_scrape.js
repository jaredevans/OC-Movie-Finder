// test_amc_api_scrape.js
// Test script using AMC's official API to fetch Open Caption showtimes
// Usage: node test_amc_api_scrape.js

require('dotenv').config();
const https = require('https');

const API_KEY = process.env.AMC_API_KEY;
const API_BASE_URL = 'api.amctheatres.com'; // Using production API instead of sandbox

if (!API_KEY) {
    console.error('Error: AMC_API_KEY not found in .env file');
    process.exit(1);
}

async function makeAPIRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_BASE_URL,
            path: path,
            method: 'GET',
            headers: {
                'X-AMC-Vendor-Key': API_KEY,
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`Failed to parse JSON: ${e.message}`));
                    }
                } else {
                    reject(new Error(`API returned status ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.end();
    });
}

async function main() {
    console.log('Starting AMC API test...\n');
    console.log('API Key:', API_KEY);
    console.log('Base URL:', API_BASE_URL);
    console.log('---\n');

    try {
        // Step 1: Get list of theatres
        console.log('Step 1: Fetching theatres list...\n');

        try {
            const theatresData = await makeAPIRequest('/v2/theatres?page-size=5');
            const theatres = theatresData._embedded?.theatres || [];

            console.log(`✓ Found ${theatresData.count || theatres.length} total theatres`);
            console.log(`Showing first ${theatres.length}:\n`);

            theatres.forEach((t, i) => {
                console.log(`${i + 1}. ${t.name} (ID: ${t.id})`);
                console.log(`   ${t.location?.city}, ${t.location?.state}`);
                console.log(`   Slug: ${t.slug}\n`);
            });

            // Use first theatre for testing
            if (theatres.length > 0) {
                const testTheatre = theatres[0];
                console.log(`\n--- Using theatre: ${testTheatre.name} (ID: ${testTheatre.id}) ---\n`);

                // Step 2: Get showtimes for this theatre
                console.log('Step 2: Fetching showtimes...\n');

                // Format date as M-D-YY (AMC API format from docs)
                const today = new Date();
                const month = today.getMonth() + 1;
                const day = today.getDate();
                const year = today.getFullYear().toString().slice(-2);
                const dateStr = `${month}-${day}-${year}`;

                console.log(`Date: ${dateStr}\n`);

                // Try to get showtimes with Open Caption filter
                try {
                    const showtimesPath = `/v2/theatres/${testTheatre.id}/showtimes/${dateStr}?page-size=100`;
                    console.log(`Request: ${showtimesPath}\n`);

                    const showtimesData = await makeAPIRequest(showtimesPath);
                    const showtimes = showtimesData._embedded?.showtimes || [];

                    console.log(`✓ Found ${showtimes.length} showtimes total\n`);

                    // Filter for Open Caption
                    const ocShowtimes = showtimes.filter(st => {
                        const attributes = st.attributes || [];
                        return attributes.some(attr =>
                            attr.code?.toLowerCase().includes('opencaption') ||
                            attr.code?.toLowerCase().includes('oc') ||
                            attr.name?.toLowerCase().includes('open caption')
                        );
                    });

                    console.log(`Open Caption showtimes: ${ocShowtimes.length}\n`);

                    if (ocShowtimes.length > 0) {
                        ocShowtimes.forEach((st, i) => {
                            console.log(`${i + 1}. ${st.movieName}`);
                            console.log(`   Time: ${st.showDateTimeLocal}`);
                            console.log(`   Attributes: ${st.attributes.map(a => a.name || a.code).join(', ')}`);
                            console.log(`   Purchase: ${st.purchaseUrl}\n`);
                        });
                    } else {
                        console.log('No Open Caption showtimes found.');
                        console.log('\nShowing all attributes from first showtime for debugging:');
                        if (showtimes.length > 0) {
                            console.log(`Movie: ${showtimes[0].movieName}`);
                            console.log('Attributes:', JSON.stringify(showtimes[0].attributes, null, 2));
                        }
                    }

                } catch (e) {
                    console.error('Error fetching showtimes:', e.message);
                }

                // Step 3: Try filtering showtimes with include-attributes parameter
                console.log('\n---\nStep 3: Trying with attribute filter...\n');

                try {
                    // Try various attribute codes for Open Caption
                    const attributeCodes = ['opencaption', 'open-caption', 'oc', 'cc', 'closed-caption'];

                    for (const attrCode of attributeCodes) {
                        try {
                            const filteredPath = `/v2/theatres/${testTheatre.id}/showtimes/${dateStr}?include-attributes=${attrCode}&page-size=100`;
                            console.log(`Trying attribute: ${attrCode}`);

                            const filteredData = await makeAPIRequest(filteredPath);
                            const filtered = filteredData._embedded?.showtimes || [];

                            if (filtered.length > 0) {
                                console.log(`✓ SUCCESS with attribute '${attrCode}': Found ${filtered.length} showtimes\n`);
                                filtered.slice(0, 3).forEach((st, i) => {
                                    console.log(`${i + 1}. ${st.movieName} at ${st.showDateTimeLocal}`);
                                });
                                console.log();
                                break;
                            } else {
                                console.log(`✗ No results with '${attrCode}'\n`);
                            }
                        } catch (e) {
                            console.log(`✗ Error with '${attrCode}': ${e.message}\n`);
                        }
                    }
                } catch (e) {
                    console.error('Error in attribute filtering:', e.message);
                }
            }

        } catch (e) {
            console.error('Error fetching theatres:', e.message);
            console.log('\nThis could mean:');
            console.log('- The sandbox API is currently down (520 errors were seen earlier)');
            console.log('- The API key needs different permissions');
            console.log('- Try the production API if you have access');
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }

    console.log('\n---\nAMC API test complete.');
    console.log('\nNote: The sandbox may have limited data or be temporarily unavailable.');
    console.log('If the API is working, this script shows how to:');
    console.log('1. Fetch theatre lists');
    console.log('2. Get showtimes for a specific theatre and date');
    console.log('3. Filter for Open Caption showtimes');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
