#!/usr/bin/env node

/**
 * Test script: Scrapes Regal theaters and stops after finding the first OC movie.
 * Does NOT modify the database.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const theaters = [
    { name: 'Regal Rockville Center', url: 'https://www.regmovies.com/theatres/regal-rockville-center-0336', city: 'Rockville', state: 'MD' },
    { name: 'Regal Majestic 20', url: 'https://www.regmovies.com/theatres/regal-majestic-1862', city: 'Silver Spring', state: 'MD' },
    { name: 'Regal Gallery Place 4DX', url: 'https://www.regmovies.com/theatres/regal-gallery-place-4dx-1551', city: 'Washington', state: 'DC' }
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

    console.log('Testing Regal OC detection...');
    console.log(`Checking dates: ${dates.join(', ')}\n`);

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

    for (const theater of theaters) {
        const theaterCode = theater.url.match(/regal-[^-]+-(?:center-)?(\d+)/)?.[1] ||
            theater.url.match(/-(\d+)$/)?.[1] || '0336';

        for (const dateStr of dates) {
            const [year, month, day] = dateStr.split('-');
            const regalDate = `${month}-${day}-${year}`;
            const url = `${theater.url}?date=${regalDate}`;

            console.log(`Checking ${theater.name} on ${dateStr}...`);

            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

                const movies = await page.evaluate(async (theaterCode, apiDate) => {
                    const results = [];
                    try {
                        const apiUrl = `https://www.regmovies.com/api/getShowtimes?theatres=${theaterCode}&date=${apiDate}&hoCode=&ignoreCache=false&moviesOnly=false`;
                        const response = await fetch(apiUrl);
                        if (!response.ok) return results;
                        const apiData = await response.json();

                        if (apiData && apiData.shows && apiData.shows.length > 0) {
                            const films = apiData.shows[0].Film;
                            if (films && Array.isArray(films)) {
                                for (const movie of films) {
                                    if (movie.Performances) {
                                        for (const perf of movie.Performances) {
                                            if (perf.PerformanceAttributes && perf.PerformanceAttributes.includes('OC')) {
                                                results.push({
                                                    title: movie.Title,
                                                    calendarShowTime: perf.CalendarShowTime,
                                                    attributes: perf.PerformanceAttributes
                                                });
                                                return results; // stop at first match
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Error fetching Regal API:', e);
                    }
                    return results;
                }, theaterCode, regalDate);

                if (movies.length > 0) {
                    const movie = movies[0];
                    const timeMatch = movie.calendarShowTime.match(/T(\d{2}):(\d{2})/);
                    let timeStr = movie.calendarShowTime;
                    if (timeMatch) {
                        let hours = parseInt(timeMatch[1], 10);
                        const minutes = timeMatch[2];
                        const modifier = hours >= 12 ? 'PM' : 'AM';
                        if (hours > 12) hours -= 12;
                        if (hours === 0) hours = 12;
                        timeStr = `${hours}:${minutes} ${modifier}`;
                    }

                    console.log(`\n✅ Found OC movie!`);
                    console.log(`  Title:      ${movie.title}`);
                    console.log(`  Theater:    ${theater.name} (${theater.city}, ${theater.state})`);
                    console.log(`  Date:       ${dateStr}`);
                    console.log(`  Time:       ${timeStr}`);
                    console.log(`  Attributes: ${movie.attributes.join(', ')}`);

                    await browser.close();
                    process.exit(0);
                }
            } catch (error) {
                console.error(`  Error: ${error.message}`);
            }
        }
    }

    await browser.close();
    console.log('\n❌ No OC movies found across all theaters and dates.');
    process.exit(1);
})();
