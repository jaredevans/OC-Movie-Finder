// test_amc_rockville.js
// Search for AMC theaters near Rockville/20902 and find all Open Caption/Subtitled showtimes
// Usage: node test_amc_rockville.js

require('dotenv').config();
const https = require('https');

const API_KEY = process.env.AMC_API_KEY;
const API_BASE_URL = 'api.amctheatres.com';

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

        console.log(`  → GET ${path}`);

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
                    reject(new Error(`API returned status ${res.statusCode}: ${data.slice(0, 500)}`));
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
    console.log('='.repeat(60));
    console.log('AMC API - Rockville/20902 Area Theater Search');
    console.log('='.repeat(60));
    console.log();

    try {
        // Step 1: Search for theaters near 20902 (Rockville/Silver Spring area)
        // Using geo-coordinates for 20902 zip code: approximately 39.0458, -77.0439
        const lat = 39.0458;
        const lon = -77.0439;
        const radius = 20; // miles

        console.log('Step 1: Finding theaters near 20902 (Rockville, MD area)...\n');

        // Try searching by location
        let theatres = [];
        try {
            const theatresData = await makeAPIRequest(`/v2/theatres?lat=${lat}&lon=${lon}&radius=${radius}&page-size=10`);
            theatres = theatresData._embedded?.theatres || [];
            console.log(`\n✓ Found ${theatres.length} theaters within ${radius} miles:\n`);
        } catch (e) {
            // Fallback: get all theatres and filter by state
            console.log('Location search failed, trying state filter...\n');
            const theatresData = await makeAPIRequest('/v2/theatres?page-size=50');
            theatres = (theatresData._embedded?.theatres || []).filter(t =>
                t.location?.state === 'MD' || t.location?.state === 'DC' || t.location?.state === 'VA'
            );
            console.log(`\n✓ Found ${theatres.length} theaters in MD/DC/VA area:\n`);
        }

        theatres.forEach((t, i) => {
            console.log(`${i + 1}. ${t.name} (ID: ${t.id})`);
            console.log(`   📍 ${t.location?.city}, ${t.location?.state} ${t.location?.postalCode}`);
            if (t.distance) console.log(`   📏 Distance: ${t.distance} miles`);
            console.log();
        });

        if (theatres.length === 0) {
            console.log('No theaters found. Exiting.');
            return;
        }

        // Step 2: Get showtimes and collect ALL unique attributes
        console.log('\n' + '='.repeat(60));
        console.log('Step 2: Fetching showtimes and analyzing attributes...');
        console.log('='.repeat(60) + '\n');

        // Format today's date
        const today = new Date();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        const year = today.getFullYear().toString().slice(-2);
        const dateStr = `${month}-${day}-${year}`;

        console.log(`Date: ${dateStr}\n`);

        const allAttributes = new Map(); // Track all unique attributes with examples
        const captionedShowtimes = []; // Collect caption/subtitle related showtimes

        // Check first 3 theaters
        const theatresToCheck = theatres.slice(0, 3);

        for (const theatre of theatresToCheck) {
            console.log(`\n--- ${theatre.name} ---\n`);

            try {
                const showtimesData = await makeAPIRequest(`/v2/theatres/${theatre.id}/showtimes/${dateStr}?page-size=200`);
                const showtimes = showtimesData._embedded?.showtimes || [];

                console.log(`  Found ${showtimes.length} total showtimes\n`);

                showtimes.forEach(st => {
                    const attrs = st.attributes || [];

                    // Collect all unique attributes
                    attrs.forEach(attr => {
                        const key = attr.code || attr.name;
                        if (!allAttributes.has(key)) {
                            allAttributes.set(key, {
                                code: attr.code,
                                name: attr.name,
                                description: attr.description,
                                example: st.movieName
                            });
                        }
                    });

                    // Check for caption/subtitle related attributes
                    const hasCaptionAttr = attrs.some(attr => {
                        const code = (attr.code || '').toLowerCase();
                        const name = (attr.name || '').toLowerCase();
                        return code.includes('caption') ||
                            code.includes('subtitle') ||
                            code.includes('oc') ||
                            code.includes('cc') ||
                            code.includes('deaf') ||
                            code.includes('hoh') ||
                            name.includes('caption') ||
                            name.includes('subtitle') ||
                            name.includes('open caption') ||
                            name.includes('closed caption');
                    });

                    if (hasCaptionAttr) {
                        captionedShowtimes.push({
                            theatre: theatre.name,
                            movie: st.movieName,
                            time: st.showDateTimeLocal,
                            attributes: attrs.map(a => a.name || a.code).join(', '),
                            purchaseUrl: st.purchaseUrl
                        });
                    }
                });

            } catch (e) {
                console.log(`  Error: ${e.message}\n`);
            }
        }

        // Step 3: Display all unique attributes found
        console.log('\n' + '='.repeat(60));
        console.log('Step 3: ALL UNIQUE ATTRIBUTES FOUND');
        console.log('='.repeat(60) + '\n');

        const sortedAttrs = [...allAttributes.entries()].sort((a, b) => a[0].localeCompare(b[0]));

        sortedAttrs.forEach(([key, attr], i) => {
            console.log(`${i + 1}. ${key}`);
            if (attr.name && attr.name !== key) console.log(`   Name: ${attr.name}`);
            if (attr.description) console.log(`   Description: ${attr.description}`);
            console.log(`   Example movie: ${attr.example}`);
            console.log();
        });

        // Step 4: Display caption/subtitle related showtimes
        console.log('\n' + '='.repeat(60));
        console.log('Step 4: CAPTION/SUBTITLE RELATED SHOWTIMES');
        console.log('='.repeat(60) + '\n');

        if (captionedShowtimes.length > 0) {
            captionedShowtimes.forEach((st, i) => {
                console.log(`${i + 1}. ${st.movie}`);
                console.log(`   🎬 ${st.theatre}`);
                console.log(`   🕐 ${st.time}`);
                console.log(`   🏷️  ${st.attributes}`);
                console.log();
            });
        } else {
            console.log('No caption/subtitle showtimes found with current criteria.\n');
            console.log('Looking for attributes that might indicate accessibility features...\n');

            // Search for any accessibility-related attributes
            const accessibilityKeywords = ['access', 'assist', 'audio', 'visual', 'sensory', 'deaf', 'hearing'];
            const accessibilityAttrs = sortedAttrs.filter(([key, attr]) => {
                const searchStr = `${key} ${attr.name || ''} ${attr.description || ''}`.toLowerCase();
                return accessibilityKeywords.some(kw => searchStr.includes(kw));
            });

            if (accessibilityAttrs.length > 0) {
                console.log('Potential accessibility-related attributes:\n');
                accessibilityAttrs.forEach(([key, attr]) => {
                    console.log(`  • ${key} - ${attr.name || '(no name)'}`);
                });
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('Done!');
        console.log('='.repeat(60));

    } catch (err) {
        console.error('Error:', err.message);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
