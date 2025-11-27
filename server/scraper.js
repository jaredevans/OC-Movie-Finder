const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const db = require('./db');

async function scrapeMovies(onProgress = null) {
    console.log('Starting scrape...');
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

    // Set a real User-Agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    });

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Define theaters to scrape
    const theaters = [
        {
            name: 'AMC Montgomery 16',
            url: 'https://www.amctheatres.com/movie-theatres/washington-d-c/amc-montgomery-16/showtimes',
            city: 'Bethesda',
            state: 'MD',
            zip: '20817',
            type: 'amc'
        },
        {
            name: 'AMC Georgetown 14',
            url: 'https://www.amctheatres.com/movie-theatres/washington-d-c/amc-georgetown-14/showtimes',
            city: 'Washington',
            state: 'DC',
            zip: '20007',
            type: 'amc'
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
        // Use local date string in YYYY-MM-DD format
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

        for (const theater of theaters) {
            console.log(`Scraping ${theater.name}...`);
            if (onProgress) {
                onProgress({ type: 'theater', theater: theater.name, location: `${theater.city}, ${theater.state}` });
            }

            for (const dateStr of dates) {
                let url;
                let regalDate;
                if (theater.type === 'regal') {
                    // Regal uses MM-DD-YYYY
                    const [year, month, day] = dateStr.split('-');
                    regalDate = `${month}-${day}-${year}`;
                    url = `${theater.url}?date=${regalDate}`;
                } else {
                    // AMC uses YYYY-MM-DD
                    url = `${theater.url}?date=${dateStr}`;
                }

                console.log(`Scraping ${url}...`);
                if (onProgress) {
                    onProgress({ type: 'date', date: dateStr, theater: theater.name });
                }

                try {
                    // Use domcontentloaded for both - Regal will use API, AMC still needs basic page load
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

                    if (theater.type === 'amc') {
                        // AMC specific wait
                        try {
                            await page.waitForSelector('.ShowtimesByTheatre-film', { timeout: 5000 });
                        } catch (e) {
                            try {
                                await page.waitForSelector('section[aria-label*="Showtimes for"]', { timeout: 5000 });
                            } catch (e2) {
                                console.log('No movie elements found on this page.');
                            }
                        }
                    }

                    const movies = await page.evaluate(async (pageUrl, theaterType, theaterCode, apiDate) => {
                        const results = [];

                        if (theaterType === 'regal') {
                            // Regal API-based scraping
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
                                                        // Extract time from CalendarShowTime (e.g., "2025-11-29T09:15:00")
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

                        } else {
                            // AMC Scraping Logic
                            const movieSections = document.querySelectorAll('section[aria-label*="Showtimes for"]');

                            movieSections.forEach((section) => {
                                const titleElement = section.querySelector('h1 a');
                                if (!titleElement) return;
                                const title = titleElement.innerText.trim();

                                const ocListItems = section.querySelectorAll('li[role="listitem"][aria-label*="Open Caption"]');

                                ocListItems.forEach((item) => {
                                    const showtimeLinks = item.querySelectorAll('a[href*="/showtimes/"]');
                                    showtimeLinks.forEach((link) => {
                                        const timeText = link.innerText.trim();
                                        results.push({
                                            title,
                                            showtime: timeText,
                                            url: pageUrl
                                        });
                                    });
                                });
                            });
                        }

                        return results;
                    }, url, theater.type, theater.url.match(/regal-[^-]+-center-(\d+)/)?.[1] || '0336', regalDate);

                    console.log(`Found ${movies.length} movies for ${dateStr} at ${theater.name}`);

                    for (const movie of movies) {
                        // Convert time to ISO
                        const timeMatch = movie.showtime.match(/(\d{1,2}):(\d{2})([ap]m)/i);
                        if (timeMatch) {
                            let [_, hours, minutes, modifier] = timeMatch;
                            hours = parseInt(hours, 10);
                            if (modifier.toLowerCase() === 'pm' && hours < 12) hours += 12;
                            if (modifier.toLowerCase() === 'am' && hours === 12) hours = 0;

                            const isoDateTime = `${dateStr}T${hours.toString().padStart(2, '0')}:${minutes}:00`;

                            // Insert into DB
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

                            // Emit progress event for each movie found
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
    } catch (error) {
        console.error('Scraping failed:', error);
    } finally {
        await browser.close();
    }

    return totalAdded;
}

module.exports = scrapeMovies;
