const scrapeMovies = require('./scraper');

(async () => {
    try {
        const count = await scrapeMovies();
        console.log(`Scraped ${count} movies.`);
    } catch (err) {
        console.error(err);
    }
})();
