// test_one_regal_scrape.js
// Standalone test script to scrape Open Caption showtimes from a single Regal URL
// Usage: node test_one_regal_scrape.js

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://www.regmovies.com/theatres/regal-rockville-center-0336?date=11-29-2025';

async function main() {
  console.log('Starting single Regal OC scrape test...');
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
    console.log('\nNavigating to Regal showtimes page...');
    // Regal pages are heavy; wait for network idle
    await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: 60000 });

    // Scroll to bottom to trigger lazy loading (same pattern as scraper.js)
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight - window.innerHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Small extra wait for any remaining lazy-loaded content
    await new Promise((r) => setTimeout(r, 2000));

    const movies = await page.evaluate((pageUrl) => {
      const results = [];

      // Regal scraping logic mirroring server/scraper.js
      const containers = document.querySelectorAll('div[class*="e1hace1532"]');

      containers.forEach((container) => {
        const titleEl = container.querySelector('a[aria-label]');
        if (!titleEl) return;

        let title = titleEl.getAttribute('aria-label');
        if (!title) return;

        // Clean title (remove " (Open Cap/Eng Sub)")
        title = title.replace(/\(Open Cap\/Eng Sub\)/i, '').trim();

        // Look for the "Open Captioned" label within the container
        const allDivs = Array.from(container.querySelectorAll('div'));
        const openCapEl = allDivs.find((el) => el.innerText === 'Open Captioned');

        if (openCapEl) {
          // Try to find the row containing both the label and the showtime buttons
          let formatRow = openCapEl.closest('div[class*="e1hace1540"]');
          if (!formatRow) {
            // Fallback traversal if class changed
            formatRow = openCapEl.parentElement;
            while (formatRow && !formatRow.querySelector('button')) {
              formatRow = formatRow.parentElement;
              if (formatRow === container) break;
            }
          }

          if (formatRow) {
            const buttons = formatRow.querySelectorAll('button');
            buttons.forEach((btn) => {
              const time = btn.innerText.trim();
              // Validate time like "9:15am" / "9:15pm"
              if (time.match(/\d{1,2}:\d{2}[ap]m/i)) {
                results.push({
                  title,
                  showtime: time,
                  url: pageUrl,
                });
              }
            });
          }
        }
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

    // Expectation check: we "expect" 1 OC movie
    const EXPECTED_COUNT = 1;
    if (movies.length !== EXPECTED_COUNT) {
      console.warn(
        `\n[Warning] Expected ${EXPECTED_COUNT} OC showtime, but found ${movies.length}. ` +
          'This may mean the page layout, date, or showtimes have changed.'
      );
    } else {
      console.log('\nSuccess: Found exactly 1 Open Caption showtime as expected.');
    }
  } catch (err) {
    console.error('\nUnexpected error in Regal single-page test:', err);
  } finally {
    await browser.close();
    console.log('\nSingle Regal scrape test complete.');
  }
}

main().catch((err) => {
  console.error('Fatal error in Regal single-page test:', err);
  process.exit(1);
});
