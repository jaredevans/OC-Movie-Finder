const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const db = require('./db');

async function scrapeRegalOnly() {
    console.log('Starting Regal-only scrape...');
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

    const theater = {
        name: 'Regal Rockville Center',
        url: 'https://www.regmovies.com/theatres/regal-rockville-center-0336',
        city: 'Rockville',
        state: 'MD',
        zip: '20850',
        type: 'regal'
    };

    // Scrape Nov 29, 2025 (known to have The Running Man)
    const dateStr = '2025-11-29';

    try {
        // Clear existing data
        await new Promise((resolve, reject) => {
            db.run("DELETE FROM movies", (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log("Cleared existing movies.");

        // Format date for Regal (MM-DD-YYYY)
        const [y, m, d] = dateStr.split('-');
        const regalDate = `${m}-${d}-${y}`;
        const url = `${theater.url}?date=${regalDate}`;

        console.log(`Scraping ${url}...`);

        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        // Scroll to trigger lazy loading
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                var totalHeight = 0;
                var distance = 100;
                var timer = setInterval(() => {
                    var scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight - window.innerHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
        await new Promise(r => setTimeout(r, 2000));

        const movies = await page.evaluate((pageUrl) => {
            const results = [];
            const containers = document.querySelectorAll('div[class*="e1hace1532"]');

            containers.forEach(container => {
                const titleEl = container.querySelector('a[aria-label]');
                if (!titleEl) return;

                let title = titleEl.getAttribute('aria-label');
                title = title.replace(/\(Open Cap\/Eng Sub\)/i, '').trim();

                const allDivs = Array.from(container.querySelectorAll('div'));
                const openCapEl = allDivs.find(el => el.innerText === 'Open Captioned');

                if (openCapEl) {
                    let formatRow = openCapEl.closest('div[class*="e1hace1540"]');
                    if (!formatRow) {
                        formatRow = openCapEl.parentElement;
                        while (formatRow && !formatRow.querySelector('button')) {
                            formatRow = formatRow.parentElement;
                            if (formatRow === container) break;
                        }
                    }

                    if (formatRow) {
                        const buttons = formatRow.querySelectorAll('button');
                        buttons.forEach(btn => {
                            const time = btn.innerText;
                            if (time.match(/\d{1,2}:\d{2}[ap]m/i)) {
                                results.push({
                                    title,
                                    showtime: time,
                                    url: pageUrl
                                });
                            }
                        });
                    }
                }
            });

            return results;
        }, url);

        console.log(`\nFound ${movies.length} Open Caption movies at Regal:`);

        let totalAdded = 0;
        for (const movie of movies) {
            const timeMatch = movie.showtime.match(/(\d{1,2}):(\d{2})([ap]m)/i);
            if (timeMatch) {
                let [_, hours, minutes, modifier] = timeMatch;
                hours = parseInt(hours, 10);
                if (modifier.toLowerCase() === 'pm' && hours < 12) hours += 12;
                if (modifier.toLowerCase() === 'am' && hours === 12) hours = 0;

                const isoDateTime = `${dateStr}T${hours.toString().padStart(2, '0')}:${minutes}:00`;

                await new Promise((resolve) => {
                    db.run(
                        `INSERT INTO movies (title, theater_name, theater_city, theater_state, theater_zip, showtime, url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [movie.title, theater.name, theater.city, theater.state, theater.zip, isoDateTime, movie.url],
                        (err) => {
                            if (err) console.error('Error inserting movie:', err);
                            resolve();
                        }
                    );
                });
                console.log(`  ✓ ${movie.title} at ${movie.showtime}`);
                totalAdded++;
            }
        }

        console.log(`\n✅ Successfully added ${totalAdded} Regal movies to database`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

scrapeRegalOnly().then(() => process.exit(0));
