// test_one_amc_scrape.js
// Standalone test script to scrape Open Caption showtimes from a single AMC URL
// Usage: node test_one_amc_scrape.js

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://www.amctheatres.com/movie-theatres/washington-d-c/amc-montgomery-16/showtimes?date=2025-12-01';

async function main() {
  console.log('Starting single AMC OC scrape test...');
  console.log(`Target URL: ${TARGET_URL}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
    ],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/122.0.0.0 Safari/537.36'
  );

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept':
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  });

  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

  try {
    console.log('\nNavigating to AMC showtimes page...');
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // AMC-specific wait – same idea as in scraper.js
    try {
      await page.waitForSelector('.ShowtimesByTheatre-film', { timeout: 5000 });
    } catch (e) {
      try {
        await page.waitForSelector('section[aria-label*="Showtimes for"]', { timeout: 5000 });
      } catch (e2) {
        console.log('No movie elements found with known selectors.');
      }
    }

    const movies = await page.evaluate((pageUrl) => {
      const results = [];

      const movieSections = document.querySelectorAll(
        'section[aria-label*="Showtimes for"]'
      );

      movieSections.forEach((section) => {
        const titleElement = section.querySelector('h1 a');
        if (!titleElement) return;

        const title = titleElement.innerText.trim();

        // Look for list items specifically marked as "Open Caption"
        const ocListItems = section.querySelectorAll(
          'li[role="listitem"][aria-label*="Open Caption"]'
        );

        ocListItems.forEach((item) => {
          const showtimeLinks = item.querySelectorAll('a.Showtime');
          showtimeLinks.forEach((link) => {
            const timeText = link.innerText.trim();
            results.push({
              title,
              showtime: timeText,
              url: pageUrl,
            });
          });
        });
      });

      return results;
    }, TARGET_URL);

    console.log(`\nFound ${movies.length} Open Caption showtimes on the page.\n`);

    if (movies.length > 0) {
      movies.forEach((movie, idx) => {
        console.log(
          `${idx + 1}. ${movie.title} | ${movie.showtime} | ${movie.url}`
        );
      });
    } else {
      console.log('No Open Caption showtimes were detected with current selectors.');
    }

    // Simple expectation check: we "expect" 4, but log if this doesn't match reality
    const EXPECTED_COUNT = 4;
    if (movies.length !== EXPECTED_COUNT) {
      console.warn(
        `\n[Warning] Expected ${EXPECTED_COUNT} OC showtimes, but found ${movies.length}. ` +
          'This may mean the page layout, date, or showtimes have changed.'
      );
    } else {
      console.log('\nSuccess: Found exactly 4 Open Caption showtimes as expected.');
    }
  } catch (err) {
    console.error('\nUnexpected error in AMC single-page test:', err);
  } finally {
    await browser.close();
    console.log('\nSingle AMC scrape test complete.');
  }
}

main().catch((err) => {
  console.error('Fatal error in AMC single-page test:', err);
  process.exit(1);
});
