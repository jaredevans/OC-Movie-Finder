// test_one_regal_scrape.js
// Standalone test script to scrape Open Caption showtimes from a single Regal URL
// Usage: node test_one_regal_scrape.js

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const TARGET_URL =
  'https://www.regmovies.com/theatres/regal-rockville-center-0336?date=11-29-2025';

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
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  });

  // page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

  try {
    console.log('\nNavigating to Regal showtimes page...');
    // Just load the page to establish session for API call
    await page.goto(TARGET_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    console.log('Fetching data from API...');

    const apiResult = await page.evaluate(async () => {
      const apiUrl =
        'https://www.regmovies.com/api/getShowtimes?theatres=0336&date=11-29-2025&hoCode=&ignoreCache=false&moviesOnly=false';

      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/json, text/plain, */*',
          },
        });

        const status = response.status;
        const statusText = response.statusText;

        const text = await response.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch (e) {
          // not JSON
        }

        // Return both raw and parsed pieces so Node side can inspect them
        return {
          status,
          statusText,
          isJson: !!json,
          rawTextSnippet: text.slice(0, 500),
          data: json,
        };
      } catch (e) {
        return {
          error: e.toString(),
        };
      }
    });

    console.log('\n--- API RESPONSE SUMMARY ---');
    if (apiResult.error) {
      console.error('API Error (fetch threw):', apiResult.error);
      return;
    }

    console.log('Status:', apiResult.status, apiResult.statusText);
    console.log('Is JSON:', apiResult.isJson);
    console.log('Raw snippet:\n', apiResult.rawTextSnippet);

    if (!apiResult.isJson || !apiResult.data) {
      console.log(
        '\nNo JSON payload – likely HTML error page or some non-JSON response.'
      );
      return;
    }

    const apiData = apiResult.data;

    // Basic structure introspection
    const shows = apiData.shows || apiData.Shows || apiData.SHOWS || [];
    console.log('\nshows length:', shows.length);

    if (!shows.length) {
      console.log('No shows array in payload.');
      return;
    }

    const films = Array.isArray(shows[0].Film) ? shows[0].Film : [];
    console.log('Film count in first shows[0].Film:', films.length);
    console.log(
      'Film titles:',
      films.map((f) => f.Title)
    );

    // Walk through performances and log attributes
    const movies = [];

    films.forEach((movie) => {
      const title = movie.Title.replace(/\(Open Cap\/Eng Sub\)/i, '').trim();

      (movie.Performances || []).forEach((perf) => {
        const attrs = perf.PerformanceAttributes || [];
        const calTime = perf.CalendarShowTime;

        console.log(
          'Perf:',
          JSON.stringify({
            title,
            PerformanceAttributes: attrs,
            CalendarShowTime: calTime,
          })
        );

        if (attrs.includes('OC')) {
          // Extract time from CalendarShowTime (e.g., "2025-11-29T09:15:00")
          const timeMatch = calTime && calTime.match(/T(\d{2}):(\d{2})/);
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
              url: TARGET_URL,
            });
          }
        }
      });
    });

    console.log(`\nFound ${movies.length} Open Caption showtimes on the page.\n`);

    if (movies.length > 0) {
      movies.forEach((movie, idx) => {
        console.log(
          `${idx + 1}. ${movie.title} | ${movie.showtime} | ${movie.url}`
        );
      });
    } else {
      console.log(
        'No Open Caption showtimes were detected with current attributes.'
      );
    }

    // Expectation check: useful while we’re debugging
    const EXPECTED_COUNT = 1;
    if (movies.length !== EXPECTED_COUNT) {
      console.warn(
        `\n[Warning] Expected ${EXPECTED_COUNT} OC showtime, but found ${movies.length}. ` +
          'This may mean the page layout, date, showtimes, or API payload differ on this machine/IP.'
      );
    } else {
      console.log(
        '\nSuccess: Found exactly 1 Open Caption showtime as expected.'
      );
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
