const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const https = require('https');
puppeteer.use(StealthPlugin());

require('dotenv').config();

const db = require('./db');

// AMC API Configuration
const AMC_API_KEY = process.env.AMC_API_KEY;
const AMC_API_HOST = 'api.amctheatres.com';

// Attribute codes that indicate Open Caption or Subtitled movies
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

// AMC API request helper
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
                    reject(new Error(`API returned status ${res.statusCode}`));
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.end();
    });
}

// Check if showtime has OC or subtitle attributes
function isOCOrSubtitled(attributes) {
    return attributes.some(attr => {
        const code = (attr.code || '').toUpperCase();
        const name = (attr.name || '').toLowerCase();

        if (OC_SUBTITLE_ATTRIBUTES.includes(code)) return true;

        if (name.includes('open caption') ||
            name.includes('subtitle') ||
            name.includes('english sub')) {
            return true;
        }

        return false;
    });
}

// Format date for AMC API (M-D-YY)
function formatAMCDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${parseInt(month)}-${parseInt(day)}-${year.slice(-2)}`;
}

// Scrape AMC theater using official API
async function scrapeAMCTheater(theater, dates, onProgress) {
    const results = [];

    if (!AMC_API_KEY) {
        console.log(`Skipping ${theater.name} - AMC_API_KEY not configured`);
        return results;
    }

    console.log(`Fetching ${theater.name} via AMC API...`);
    if (onProgress) {
        onProgress({ type: 'theater', theater: theater.name, location: `${theater.city}, ${theater.state}` });
    }

    for (const dateStr of dates) {
        const amcDate = formatAMCDate(dateStr);

        if (onProgress) {
            onProgress({ type: 'date', date: dateStr, theater: theater.name });
        }

        try {
            const path = `/v2/theatres/${theater.amcId}/showtimes/${amcDate}?page-size=200`;
            const data = await makeAMCAPIRequest(path);
            const showtimes = data._embedded?.showtimes || [];

            // Filter for OC/Subtitled showtimes
            const ocShowtimes = showtimes.filter(st => isOCOrSubtitled(st.attributes || []));

            console.log(`  ${dateStr}: Found ${ocShowtimes.length} OC/Subtitled showtimes`);

            for (const st of ocShowtimes) {
                // Parse ISO datetime from API
                const showDateTime = st.showDateTimeLocal; // e.g., "2025-12-27T09:30:00"

                results.push({
                    title: st.movieName,
                    showtime: showDateTime,
                    url: st.purchaseUrl || theater.url,
                    theater: theater
                });

                if (onProgress) {
                    const time = new Date(showDateTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                    });
                    onProgress({
                        type: 'movie',
                        title: st.movieName,
                        showtime: time,
                        theater: theater.name,
                        date: dateStr
                    });
                }
            }

        } catch (error) {
            console.error(`  Error fetching ${dateStr} for ${theater.name}:`, error.message);
        }
    }

    return results;
}

async function scrapeMovies(onProgress = null) {
    console.log('Starting scrape...');

    // Define theaters to scrape
    const theaters = [
        {
            name: 'AMC Montgomery 16',
            url: 'https://www.amctheatres.com/movie-theatres/washington-d-c/amc-montgomery-16/showtimes',
            city: 'Bethesda',
            state: 'MD',
            zip: '20817',
            type: 'amc',
            amcId: 348
        },
        {
            name: 'AMC Georgetown 14',
            url: 'https://www.amctheatres.com/movie-theatres/washington-d-c/amc-georgetown-14/showtimes',
            city: 'Washington',
            state: 'DC',
            zip: '20007',
            type: 'amc',
            amcId: 2654
        },
        {
            name: 'Regal Rockville Center',
            url: 'https://www.regmovies.com/theatres/regal-rockville-center-0336',
            city: 'Rockville',
            state: 'MD',
            zip: '20850',
            type: 'regal'
        },
        {
            name: 'Regal Majestic 20',
            url: 'https://www.regmovies.com/theatres/regal-majestic-1862',
            city: 'Silver Spring',
            state: 'MD',
            zip: '20910',
            type: 'regal'
        },
        {
            name: 'Regal Gallery Place 4DX',
            url: 'https://www.regmovies.com/theatres/regal-gallery-place-4dx-1551',
            city: 'Washington',
            state: 'DC',
            zip: '20001',
            type: 'regal'
        }
    ];

    // Calculate dates for the next 7 days starting from today
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
    }

    console.log(`Scraping dates: ${dates.join(', ')}`);

    let totalAdded = 0;

    try {
        // Clear existing data before adding new
        await new Promise((resolve, reject) => {
            db.run("DELETE FROM movies", (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log("Cleared existing movies.");

        // Separate AMC and Regal theaters
        const amcTheaters = theaters.filter(t => t.type === 'amc');
        const regalTheaters = theaters.filter(t => t.type === 'regal');

        // Process AMC theaters via API (no browser needed)
        for (const theater of amcTheaters) {
            const movies = await scrapeAMCTheater(theater, dates, onProgress);

            for (const movie of movies) {
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO movies (title, theater_name, theater_city, theater_state, theater_zip, showtime, url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [movie.title, movie.theater.name, movie.theater.city, movie.theater.state, movie.theater.zip, movie.showtime, movie.url],
                        (err) => {
                            if (err) console.error('Error inserting movie:', err);
                            resolve();
                        }
                    );
                });
                totalAdded++;
            }
        }

        // Process Regal theaters via Puppeteer (unchanged)
        if (regalTheaters.length > 0) {
            const browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--window-size=1920,1080'
                ]
            });
            const page = await browser.newPage();

            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            });

            page.on('console', msg => console.log('PAGE LOG:', msg.text()));

            for (const theater of regalTheaters) {
                console.log(`Scraping ${theater.name}...`);
                if (onProgress) {
                    onProgress({ type: 'theater', theater: theater.name, location: `${theater.city}, ${theater.state}` });
                }

                for (const dateStr of dates) {
                    // Regal uses MM-DD-YYYY
                    const [year, month, day] = dateStr.split('-');
                    const regalDate = `${month}-${day}-${year}`;
                    const url = `${theater.url}?date=${regalDate}`;

                    console.log(`Scraping ${url}...`);
                    if (onProgress) {
                        onProgress({ type: 'date', date: dateStr, theater: theater.name });
                    }

                    try {
                        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

                        const theaterCode = theater.url.match(/regal-[^-]+-(?:center-)?(\d+)/)?.[1] ||
                            theater.url.match(/-(\d+)$/)?.[1] || '0336';

                        const movies = await page.evaluate(async (pageUrl, theaterCode, apiDate) => {
                            const results = [];

                            try {
                                const apiUrl = `https://www.regmovies.com/api/getShowtimes?theatres=${theaterCode}&date=${apiDate}&hoCode=&ignoreCache=false&moviesOnly=false`;
                                const response = await fetch(apiUrl);
                                if (!response.ok) {
                                    console.error('Regal API error:', response.status);
                                    return results;
                                }
                                const apiData = await response.json();

                                if (apiData && apiData.shows && apiData.shows.length > 0) {
                                    const films = apiData.shows[0].Film;
                                    if (films && Array.isArray(films)) {
                                        films.forEach(movie => {
                                            const title = movie.Title.replace(/\(Open Cap\/Eng Sub\)/i, '').trim();
                                            if (movie.Performances) {
                                                movie.Performances.forEach(perf => {
                                                    if (perf.PerformanceAttributes && perf.PerformanceAttributes.includes('OC')) {
                                                        const timeMatch = perf.CalendarShowTime.match(/T(\d{2}):(\d{2})/);
                                                        if (timeMatch) {
                                                            let hours = parseInt(timeMatch[1], 10);
                                                            const minutes = timeMatch[2];
                                                            const modifier = hours >= 12 ? 'pm' : 'am';
                                                            if (hours > 12) hours -= 12;
                                                            if (hours === 0) hours = 12;
                                                            const time = `${hours}:${minutes}${modifier}`;

                                                            results.push({
                                                                title,
                                                                showtime: time,
                                                                url: pageUrl
                                                            });
                                                        }
                                                    }
                                                });
                                            }
                                        });
                                    }
                                }
                            } catch (e) {
                                console.error('Error fetching Regal API:', e);
                            }

                            return results;
                        }, url, theaterCode, regalDate);

                        console.log(`Found ${movies.length} movies for ${dateStr} at ${theater.name}`);

                        for (const movie of movies) {
                            const timeMatch = movie.showtime.match(/(\d{1,2}):(\d{2})([ap]m)/i);
                            if (timeMatch) {
                                let [_, hours, minutes, modifier] = timeMatch;
                                hours = parseInt(hours, 10);
                                if (modifier.toLowerCase() === 'pm' && hours < 12) hours += 12;
                                if (modifier.toLowerCase() === 'am' && hours === 12) hours = 0;

                                const isoDateTime = `${dateStr}T${hours.toString().padStart(2, '0')}:${minutes}:00`;

                                await new Promise((resolve, reject) => {
                                    db.run(
                                        `INSERT INTO movies (title, theater_name, theater_city, theater_state, theater_zip, showtime, url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                        [movie.title, theater.name, theater.city, theater.state, theater.zip, isoDateTime, movie.url],
                                        (err) => {
                                            if (err) console.error('Error inserting movie:', err);
                                            resolve();
                                        }
                                    );
                                });
                                totalAdded++;

                                if (onProgress) {
                                    onProgress({
                                        type: 'movie',
                                        title: movie.title,
                                        showtime: movie.showtime,
                                        theater: theater.name,
                                        date: dateStr
                                    });
                                }
                            }
                        }

                    } catch (error) {
                        console.error(`Error scraping ${url}:`, error);
                    }
                }
            }

            await browser.close();
        }

    } catch (error) {
        console.error('Scraping failed:', error);
    }

    return totalAdded;
}

module.exports = scrapeMovies;
