#!/usr/bin/env node

/**
 * Test script: Scrapes AMC theaters and stops after finding the first OC/subtitled movie.
 * Does NOT modify the database.
 */

const https = require('https');
require('dotenv').config();

const AMC_API_KEY = process.env.AMC_API_KEY;
const AMC_API_HOST = 'api.amctheatres.com';

const OC_SUBTITLE_ATTRIBUTES = [
    'OPENCAPTION',
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
    'ENGLISHSUBTITLE',
    'SUBTITLED'
];

function makeAMCAPIRequest(path) {
    return new Promise((resolve, reject) => {
        if (!AMC_API_KEY) {
            reject(new Error('AMC_API_KEY not found in environment'));
            return;
        }

        const options = {
            hostname: AMC_API_HOST,
            path: path,
            method: 'GET',
            headers: {
                'X-AMC-Vendor-Key': AMC_API_KEY,
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error(`Failed to parse JSON: ${e.message}`)); }
                } else {
                    reject(new Error(`API returned status ${res.statusCode}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}

function isOCOrSubtitled(attributes) {
    return attributes.some(attr => {
        const code = (attr.code || '').toUpperCase();
        const name = (attr.name || '').toLowerCase();
        if (OC_SUBTITLE_ATTRIBUTES.includes(code)) return true;
        if (name.includes('open caption') || name.includes('subtitle') || name.includes('english sub')) return true;
        return false;
    });
}

function formatAMCDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${parseInt(month)}-${parseInt(day)}-${year.slice(-2)}`;
}

const theaters = [
    { name: 'AMC Montgomery 16', amcId: 348, city: 'Bethesda', state: 'MD' },
    { name: 'AMC Georgetown 14', amcId: 2654, city: 'Washington', state: 'DC' }
];

(async () => {
    const today = new Date();
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
    }

    console.log('Testing AMC OC/Subtitle detection...');
    console.log(`Checking dates: ${dates.join(', ')}\n`);

    for (const theater of theaters) {
        for (const dateStr of dates) {
            const amcDate = formatAMCDate(dateStr);
            console.log(`Checking ${theater.name} on ${dateStr}...`);

            try {
                const path = `/v2/theatres/${theater.amcId}/showtimes/${amcDate}?page-size=200`;
                const data = await makeAMCAPIRequest(path);
                const showtimes = data._embedded?.showtimes || [];
                const ocShowtimes = showtimes.filter(st => isOCOrSubtitled(st.attributes || []));

                if (ocShowtimes.length > 0) {
                    const st = ocShowtimes[0];
                    const time = new Date(st.showDateTimeLocal).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                    });
                    const matchedAttrs = (st.attributes || [])
                        .filter(a => OC_SUBTITLE_ATTRIBUTES.includes((a.code || '').toUpperCase()) ||
                            (a.name || '').toLowerCase().includes('open caption') ||
                            (a.name || '').toLowerCase().includes('subtitle') ||
                            (a.name || '').toLowerCase().includes('english sub'))
                        .map(a => `${a.code} (${a.name})`);

                    console.log(`\n✅ Found OC/Subtitled movie!`);
                    console.log(`  Title:      ${st.movieName}`);
                    console.log(`  Theater:    ${theater.name} (${theater.city}, ${theater.state})`);
                    console.log(`  Date:       ${dateStr}`);
                    console.log(`  Time:       ${time}`);
                    console.log(`  Attributes: ${matchedAttrs.join(', ')}`);
                    console.log(`  URL:        ${st.purchaseUrl || 'N/A'}`);
                    process.exit(0);
                }
            } catch (error) {
                console.error(`  Error: ${error.message}`);
            }
        }
    }

    console.log('\n❌ No OC/Subtitled movies found across all theaters and dates.');
    process.exit(1);
})();
