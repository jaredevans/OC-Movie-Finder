// test_amc_api_scrape.js
// Test script to find Open Caption and Subtitled showtimes at AMC MD/DC theaters
// Usage: node test_amc_api_scrape.js

require('dotenv').config();
const https = require('https');

const API_KEY = process.env.AMC_API_KEY;
const API_BASE_URL = 'api.amctheatres.com';

// Target theaters in MD/DC area
const THEATERS = [
    { id: 348, name: 'AMC Montgomery 16', city: 'Bethesda', state: 'MD', zip: '20817' },
    { id: 2654, name: 'AMC Georgetown 14', city: 'Washington', state: 'DC', zip: '20007' }
];

// Attribute codes that indicate Open Caption or Subtitled movies
const OC_SUBTITLE_ATTRIBUTES = [
    'OPENCAPTION',           // Open Caption (On-screen Subtitles)
    // Foreign language with English subtitles
    'NORWEGIANENGLISHSUBTITLE',
    'PORTUGUESEENGLISHSUBTITLE',
    'SPANISHENGLISHSUBTITLE',
    'FRENCHENGLISHSUBTITLE',
    'GERMANENGLISHSUBTITLE',
    'ITALIANENGLISHSUBTITLE',
    'JAPANESEENGLISHSUBTITLE',
    'KOREANENGLISHSUBTITLE',
    'CHINESEENGLISHSUBTITLE',
    'HINDISUBTITLE',
    // Generic subtitle patterns
    'ENGLISHSUBTITLE',
    'SUBTITLED'
];

if (!API_KEY) {
    console.error('Error: AMC_API_KEY not found in .env file');
    console.error('Please add AMC_API_KEY=your_key to server/.env');
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

function formatDate(date) {
    // AMC API format: M-D-YY
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear().toString().slice(-2);
    return `${month}-${day}-${year}`;
}

function isOCOrSubtitled(attributes) {
    return attributes.some(attr => {
        const code = (attr.code || '').toUpperCase();
        const name = (attr.name || '').toLowerCase();

        // Check against known attribute codes
        if (OC_SUBTITLE_ATTRIBUTES.includes(code)) return true;

        // Fallback: check name for keywords
        if (name.includes('open caption') ||
            name.includes('subtitle') ||
            name.includes('english sub')) {
            return true;
        }

        return false;
    });
}

async function main() {
    console.log('='.repeat(70));
    console.log('AMC API - Open Caption & Subtitled Movie Finder');
    console.log('='.repeat(70));
    console.log(`\nAPI Key: ${API_KEY.slice(0, 8)}...`);
    console.log(`Theaters: ${THEATERS.map(t => t.name).join(', ')}\n`);

    // Get dates for the next 7 days
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        dates.push(date);
    }

    console.log(`Checking dates: ${dates.map(d => d.toLocaleDateString()).join(', ')}\n`);
    console.log('='.repeat(70));

    const allResults = [];

    for (const theater of THEATERS) {
        console.log(`\n📍 ${theater.name} (${theater.city}, ${theater.state})`);
        console.log('-'.repeat(50));

        for (const date of dates) {
            const dateStr = formatDate(date);
            const displayDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            try {
                const path = `/v2/theatres/${theater.id}/showtimes/${dateStr}?page-size=200`;
                const data = await makeAPIRequest(path);
                const showtimes = data._embedded?.showtimes || [];

                // Filter for OC/Subtitled showtimes
                const ocShowtimes = showtimes.filter(st => isOCOrSubtitled(st.attributes || []));

                if (ocShowtimes.length > 0) {
                    console.log(`\n  📅 ${displayDate} - ${ocShowtimes.length} OC/Subtitled showings:`);

                    ocShowtimes.forEach(st => {
                        const time = new Date(st.showDateTimeLocal).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                        });

                        const attrs = (st.attributes || [])
                            .filter(a => isOCOrSubtitled([a]))
                            .map(a => a.name || a.code)
                            .join(', ');

                        console.log(`     🎬 ${st.movieName}`);
                        console.log(`        ⏰ ${time} | 🏷️  ${attrs}`);

                        // Store result for summary
                        allResults.push({
                            theater: theater.name,
                            theaterCity: theater.city,
                            theaterState: theater.state,
                            theaterZip: theater.zip,
                            movie: st.movieName,
                            showtime: st.showDateTimeLocal,
                            displayTime: time,
                            displayDate: displayDate,
                            attributes: attrs,
                            purchaseUrl: st.purchaseUrl,
                            movieId: st.movieId
                        });
                    });
                }

            } catch (e) {
                console.log(`  ❌ Error fetching ${displayDate}: ${e.message}`);
            }
        }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log(`\nTotal OC/Subtitled showtimes found: ${allResults.length}`);

    // Group by movie
    const byMovie = {};
    allResults.forEach(r => {
        if (!byMovie[r.movie]) byMovie[r.movie] = [];
        byMovie[r.movie].push(r);
    });

    console.log(`\nUnique movies with OC/Subtitles: ${Object.keys(byMovie).length}`);
    console.log('\nMovies:');
    Object.keys(byMovie).sort().forEach(movie => {
        console.log(`  • ${movie} (${byMovie[movie].length} showings)`);
    });

    // Output JSON for integration testing
    console.log('\n' + '='.repeat(70));
    console.log('JSON OUTPUT (for integration):');
    console.log('='.repeat(70));
    console.log(JSON.stringify(allResults.slice(0, 5), null, 2));
    if (allResults.length > 5) {
        console.log(`... and ${allResults.length - 5} more results`);
    }

    console.log('\n✅ Done!');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
