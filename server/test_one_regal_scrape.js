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

  // page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

  try {
    console.log('\nNavigating to Regal showtimes page...');
    // Just load the page to establish session for API call
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('Fetching data from API...');
    const apiData = await page.evaluate(async () => {
      try {
        const response = await fetch('https://www.regmovies.com/api/getShowtimes?theatres=0336&date=11-29-2025&hoCode=&ignoreCache=false&moviesOnly=false');
        if (!response.ok) return { error: response.statusText };
        return await response.json();
      } catch (e) {
        return { error: e.toString() };
      }
    });

    if (apiData.error) {
      console.error('API Error:', apiData.error);
      return;
    }

    const movies = [];
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

                  movies.push({
                    title,
                    showtime: time,
                    url: TARGET_URL
                  });
                }
              }
            });
          }
        });
      }
    }

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
