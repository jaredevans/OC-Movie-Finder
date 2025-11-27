const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

async function scrapeRegal() {
    console.log('Starting Regal scrape...');
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

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    const url = 'https://www.regmovies.com/theatres/regal-rockville-center-0336?date=11-29-2025';
    console.log(`Navigating to ${url}...`);

    try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        // Wait a bit for dynamic content
        await new Promise(r => setTimeout(r, 5000));

        // Scroll to bottom to trigger lazy loading
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

        await page.screenshot({ path: 'debug_regal.png', fullPage: true });

        // Search for keywords in DOM
        const searchResults = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const hasRunningMan = bodyText.includes("Running Man");
            const hasOpenCaptioned = bodyText.includes("Open Captioned");

            // Find elements with "Open Captioned"
            const openCapElements = [];
            const xpath = "//*[contains(text(), 'Open Captioned')]";
            const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

            for (let i = 0; i < result.snapshotLength; i++) {
                let el = result.snapshotItem(i);
                let parent = el.parentElement;
                let foundTitle = false;
                let movieContainer = null;

                // Traverse up to find the container with the title
                while (parent && !foundTitle && parent !== document.body) {
                    if (parent.innerText.includes("The Running Man")) {
                        foundTitle = true;
                        movieContainer = parent;
                    } else {
                        parent = parent.parentElement;
                    }
                }

                if (movieContainer) {
                    // Find the specific showtime element "9:15am" to understand its structure
                    const timeEl = Array.from(movieContainer.querySelectorAll('*')).find(el => el.innerText && el.innerText.includes('9:15am'));

                    openCapElements.push({
                        found: true,
                        containerClass: movieContainer.className,
                        title: "The Running Man",
                        timeElement: timeEl ? {
                            tagName: timeEl.tagName,
                            className: timeEl.className,
                            outerHTML: timeEl.outerHTML,
                            parentHTML: timeEl.parentElement.outerHTML.substring(0, 500)
                        } : 'Not found',
                        // Dump the whole container HTML to be sure
                        fullContainerHTML: movieContainer.innerHTML
                    });
                } else {
                    openCapElements.push({
                        found: false,
                        text: el.innerText,
                        parentHTML: el.parentElement ? el.parentElement.outerHTML.substring(0, 200) : 'No parent'
                    });
                }
            }

            return {
                hasRunningMan,
                hasOpenCaptioned,
                openCapElements,
                bodyTextLength: bodyText.length
            };
        });

        console.log('Search Results saved to regal_debug_data.json');
        fs.writeFileSync('regal_debug_data.json', JSON.stringify(searchResults, null, 2));
        fs.writeFileSync('regal_body_text.txt', searchResults.fullBodyText);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

scrapeRegal();
