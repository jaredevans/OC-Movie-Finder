// test_regal_scrape.js
// Standalone test script to scrape Open Caption showtimes from Regal pages
// Usage: node test_regal_scrape.js

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

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
      type: 'regal'
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

  console.log(`Testing Regal scraping for dates: ${dates.join(', ')}`);

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

  try {
    for (const theater of theaters) {
      console.log(`\n===== ${thater?.name || theater.name} (${theater.city}, ${theater.state}) =====`);

      for (const dateStr of dates) {
        // Regal expects MM-DD-YYYY
        const [year, month, day] = dateStr.split('-');
        const regalDate = `${month}-${day}-${year}`;
        const url = `${theater.url}?date=${regalDate}`;

        console.log(`\nFetching ${url} ...`);

        try {
          // Regal sites are heavy; wait for network idle
          await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

          // Scroll to bottom to trigger lazy loading
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

          // Small extra wait
          await new Promise(r => setTimeout(r, 2000));

          const movies = await page.evaluate((pageUrl) => {
            const results = [];

            // Regal Scraping Logic (mirrors main scraper)
            const containers = document.querySelectorAll('div[class*="e1hace1532"]');

            containers.forEach(container => {
              const titleEl = container.querySelector('a[aria-label]');
              if (!titleEl) return;

              let title = titleEl.getAttribute('aria-label');
              if (!title) return;

              // Clean title (remove " (Open Cap/Eng Sub)")
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
                    const time = btn.innerText.trim();
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

          console.log(`Found ${movies.length} OC showtimes for ${dateStr}.`);

          if (movies.length > 0) {
            for (const movie of movies) {
              console.log(
                `  - ${movie.title} | ${movie.showtime} | ${movie.url}`
              );
            }
          } else {
            console.log('  (No OC showtimes found for this date.)');
          }
        } catch (err) {
          console.error(`Error scraping Regal URL for ${dateStr}:`, err.message || err);
        }
      }
    }
  } catch (err) {
    console.error('Unexpected error in Regal test:', err);
  } finally {
    await browser.close();
    console.log('\nRegal scrape test complete.');
  }
}

main().catch(err => {
  console.error('Fatal error in Regal test:', err);
  process.exit(1);
});
