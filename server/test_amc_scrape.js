// test_amc_scrape.js
// Standalone test script to scrape Open Caption showtimes from AMC pages
// Usage: node test_amc_scrape.js

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const db = require('./db');

puppeteer.use(StealthPlugin());

async function main() {
  console.log('Starting AMC OC scrape test...');

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
    }
  ];

  // Next 7 days (same logic as main scraper)
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

  console.log(`Testing AMC scraping for dates: ${dates.join(', ')}`);

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

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  let totalAdded = 0;

  try {
    // Clear existing AMC movies from database
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM movies WHERE theater_name LIKE 'AMC%'", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Cleared existing AMC movies from database.\n');

    for (const theater of theaters) {
      console.log(`\n===== ${theater.name} (${theater.city}, ${theater.state}) =====`);

      for (const dateStr of dates) {
        const url = `${theater.url}?date=${dateStr}`;
        console.log(`\nFetching ${url} ...`);

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

          // AMC-specific wait: try known selectors
          try {
            await page.waitForSelector('.ShowtimesByTheatre-film', { timeout: 5000 });
          } catch (e) {
            try {
              await page.waitForSelector('section[aria-label*="Showtimes for"]', { timeout: 5000 });
            } catch (e2) {
              console.log('No movie elements found on this page.');
            }
          }

          const movies = await page.evaluate((pageUrl) => {
            const results = [];

            const movieSections = document.querySelectorAll('section[aria-label*="Showtimes for"]');

            movieSections.forEach((section) => {
              const titleElement = section.querySelector('h1 a');
              if (!titleElement) return;
              const title = titleElement.innerText.trim();

              const ocListItems = section.querySelectorAll(
                'li[role="listitem"][aria-label*="Open Caption"]'
              );

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

            return results;
          }, url);

          console.log(`Found ${movies.length} OC showtimes for ${dateStr}.`);

          if (movies.length > 0) {
            for (const movie of movies) {
              console.log(
                `  - ${movie.title} | ${movie.showtime} | ${movie.url}`
              );

              // Parse time and insert into database
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
              }
            }
          } else {
            console.log('  (No OC showtimes found for this date.)');
          }
        } catch (err) {
          console.error(`Error scraping AMC URL for ${dateStr}:`, err.message || err);
        }
      }
    }
  } catch (err) {
    console.error('Unexpected error in AMC test:', err);
  } finally {
    await browser.close();
    console.log(`\nAMC scrape test complete. Added ${totalAdded} showtimes to database.`);
  }
}

main().catch(err => {
  console.error('Fatal error in AMC test:', err);
  process.exit(1);
});
