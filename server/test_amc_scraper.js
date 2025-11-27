const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function testAMCScraper() {
    console.log('Testing AMC scraper for specific URL...');

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

    const url = 'https://www.amctheatres.com/movie-theatres/washington-d-c/amc-montgomery-16/showtimes?date=2025-11-28';

    try {
        console.log(`Navigating to: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        console.log('Waiting for content to load...');
        await new Promise(r => setTimeout(r, 3000));

        // Scroll to bottom to trigger lazy loading
        console.log('Scrolling page to load all content...');
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

        await new Promise(r => setTimeout(r, 2000)); // Wait for lazy-loaded content to render
        console.log('Finished scrolling.');
        // AMC specific wait
        try {
            await page.waitForSelector('.ShowtimesByTheatre-film', { timeout: 10000 });
        } catch (e) {
            try {
                await page.waitForSelector('section[aria-label*="Showtimes for"]', { timeout: 10000 });
            } catch (e2) {
                console.log('No movie elements found with selectors.');
            }
        }

        // Take screenshot for debugging
        await page.screenshot({ path: 'amc_test_debug.png', fullPage: true });
        console.log('Screenshot saved to amc_test_debug.png');

        // Check what actually loaded
        const bodyText = await page.evaluate(() => document.body.innerText);
        console.log(`\nPage text preview (first 500 chars):\n${bodyText.substring(0, 500)}\n`);

        // Save full HTML
        const fs = require('fs');
        const html = await page.content();
        fs.writeFileSync('amc_test_debug.html', html);
        console.log('HTML saved to amc_test_debug.html');

        // Check if we got blocked
        if (bodyText.includes('403') || bodyText.includes('Access Denied') || bodyText.includes('blocked')) {
            console.log('⚠️  Possible bot detection - page may be blocking automated access');
        }
        // Extract Open Caption movies
        const movies = await page.evaluate((pageUrl) => {
            const results = [];
            const movieSections = document.querySelectorAll('section[aria-label*="Showtimes for"]');

            console.log(`Found ${movieSections.length} movie sections`);

            movieSections.forEach((section) => {
                const titleElement = section.querySelector('h1 a');
                if (!titleElement) return;
                const title = titleElement.innerText.trim();

                const ocListItems = section.querySelectorAll('li[role="listitem"][aria-label*="Open Caption"]');

                console.log(`Movie "${title}": ${ocListItems.length} OC items`);

                ocListItems.forEach((item) => {
                    const showtimeLinks = item.querySelectorAll('a.Showtime');
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

            return results;
        }, url);

        console.log(`\n✅ Found ${movies.length} Open Caption showtimes:\n`);

        // Group by movie title
        const moviesByTitle = {};
        movies.forEach(movie => {
            if (!moviesByTitle[movie.title]) {
                moviesByTitle[movie.title] = [];
            }
            moviesByTitle[movie.title].push(movie.showtime);
        });

        Object.keys(moviesByTitle).forEach(title => {
            console.log(`🎬 ${title}`);
            console.log(`   Showtimes: ${moviesByTitle[title].join(', ')}`);
        });

        console.log(`\n📊 Summary:`);
        console.log(`   Total movies with OC: ${Object.keys(moviesByTitle).length}`);
        console.log(`   Total OC showtimes: ${movies.length}`);

        if (Object.keys(moviesByTitle).length === 3) {
            console.log(`\n✅ SUCCESS: Found all 3 expected Open Caption movies!`);
        } else {
            console.log(`\n⚠️  WARNING: Expected 3 movies, found ${Object.keys(moviesByTitle).length}`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

testAMCScraper().then(() => process.exit(0));
