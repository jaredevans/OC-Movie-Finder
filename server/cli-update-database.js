#!/usr/bin/env node

const scrapeMovies = require('./scraper');

console.log('=== OC Movie Finder - Database Update ===\n');

scrapeMovies((progress) => {
    switch (progress.type) {
        case 'theater':
            console.log(`\n🎬 ${progress.theater} (${progress.location})`);
            break;
        case 'date':
            console.log(`  📅 ${progress.date}`);
            break;
        case 'movie':
            console.log(`    ✅ ${progress.title} - ${progress.showtime}`);
            break;
    }
}).then((count) => {
    console.log(`\n=== Done! Added ${count} movies to the database. ===`);
    process.exit(0);
}).catch((err) => {
    console.error('Scraping failed:', err);
    process.exit(1);
});
