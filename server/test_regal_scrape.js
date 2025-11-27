// test_regal_scrape.js
// Standalone test script to scrape Open Caption showtimes from Regal pages
// Usage: node test_regal_scrape.js

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const db = require('./db');

puppeteer.use(StealthPlugin());

async function main() {
  console.log('Starting Regal OC scrape test...');

  const theaters = [
    {
      name: 'Regal Rockville Center',
      url: 'https://www.regmovies.com/theatres/regal-rockville-center-0336',
      city: 'Rockville',
      state: 'MD',
      zip: '20850',
      code: '0336'
    },
    {
      name: 'Regal Majestic 20',
      url: 'https://www.regmovies.com/theatres/regal-majestic-1862',
      city: 'Silver Spring',
      state: 'MD',
      zip: '20910',
      code: '1862'
    },
    {
      name: 'Regal Gallery Place 4DX',
      url: 'https://www.regmovies.com/theatres/regal-gallery-place-4dx-1551',
      city: 'Washington',
      state: 'DC',
      zip: '20001',
      code: '1551'
    }
  ];

  // Calculate dates for the next 7 days
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.push({ iso: `${year}-${month}-${day}`, regal: `${month}-${day}-${year}` });
  }

  console.log(`Testing Regal scraping for ${dates.length} days...`);

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

  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/122.0.0.0 Safari/537.36'
  );

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  });

  let totalAdded = 0;

  try {
    // Clear existing Regal movies from database
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM movies WHERE theater_name LIKE 'Regal%'", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Cleared existing Regal movies from database.\n');

    for (const theater of theaters) {
      console.log(`\n===== ${theater.name} (${theater.city}, ${theater.state}) =====`);

      for (const date of dates) {
        const url = `${theater.url}?date=${date.regal}`;
        console.log(`\nFetching ${url} ...`);

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

          const apiData = await page.evaluate(async (theaterCode, apiDate) => {
            try {
              const apiUrl = `https://www.regmovies.com/api/getShowtimes?theatres=${theaterCode}&date=${apiDate}&hoCode=&ignoreCache=false&moviesOnly=false`;
              const response = await fetch(apiUrl);
              if (!response.ok) return { error: response.statusText };
              return await response.json();
            } catch (e) {
              return { error: e.toString() };
            }
          }, theater.code, date.regal);

          if (apiData.error) {
            console.error(`  API Error: ${apiData.error}`);
            continue;
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
                          isoDateTime: perf.CalendarShowTime,
                          url
                        });
                      }
                    }
                  });
                }
              });
            }
          }

          console.log(`Found ${movies.length} OC showtimes for ${date.iso}.`);

          if (movies.length > 0) {
            for (const movie of movies) {
              console.log(
                `  - ${movie.title} | ${movie.showtime} | ${movie.url}`
              );

              await new Promise((resolve, reject) => {
                db.run(
                  `INSERT INTO movies (title, theater_name, theater_city, theater_state, theater_zip, showtime, url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [movie.title, theater.name, theater.city, theater.state, theater.zip, movie.isoDateTime, movie.url],
                  (err) => {
                    if (err) console.error('Error inserting movie:', err);
                    resolve();
                  }
                );
              });
              totalAdded++;
            }
          } else {
            console.log('  (No OC showtimes found for this date.)');
          }
        } catch (err) {
          console.error(`Error scraping Regal URL for ${date.iso}:`, err.message || err);
        }
      }
    }
  } catch (err) {
    console.error('Unexpected error in Regal test:', err);
  } finally {
    await browser.close();
    console.log(`\nRegal scrape test complete. Added ${totalAdded} showtimes to database.`);
  }
}

main().catch(err => {
  console.error('Fatal error in Regal test:', err);
  process.exit(1);
});
