#!/usr/bin/env node

/**
 * OC Movie Finder - Update and Deploy Script
 * 
 * This script:
 * 1. Scrapes AMC and Regal theaters for Open Caption showtimes
 * 2. Updates the local SQLite database
 * 3. Transfers the updated database to the production server
 */

const scrapeMovies = require('./scraper');
const { execSync } = require('child_process');
const path = require('path');

// Console colors for better output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(60));
    log(title, colors.bright + colors.cyan);
    console.log('='.repeat(60));
}

async function main() {
    const startTime = Date.now();

    try {
        logSection('🎬 OC Movie Finder - Update and Deploy');
        log(`Started at: ${new Date().toLocaleString()}`, colors.blue);

        // Step 1: Run the scraper
        logSection('📡 Step 1: Scraping AMC and Regal Theaters');
        log('This will scrape showtimes for the next 7 days from:', colors.yellow);
        log('  • AMC Montgomery 16 (Bethesda, MD)');
        log('  • AMC Georgetown 14 (Washington, DC)');
        log('  • Regal Rockville Center (Rockville, MD)');
        log('  • Regal Majestic 20 (Silver Spring, MD)');
        log('  • Regal Gallery Place 4DX (Washington, DC)');
        console.log();

        const movieCount = await scrapeMovies((progress) => {
            switch (progress.type) {
                case 'theater':
                    log(`\n📍 Starting ${progress.theater} (${progress.location})`, colors.bright);
                    break;
                case 'date':
                    log(`  📅 Processing ${progress.date}...`, colors.blue);
                    break;
                case 'movie':
                    log(`    🎬 Found: ${progress.title} at ${progress.showtime}`, colors.green);
                    break;
            }
        });

        log(`\n✅ Scraping complete! Added ${movieCount} showtimes to database.`, colors.green + colors.bright);

        // Step 2: Transfer database to production
        logSection('🚀 Step 2: Deploying to Production Server');

        const localDbPath = path.resolve(__dirname, 'movies.db');
        const remoteDbPath = 'zappy:/var/www/OC-Movie-Finder/server/movies.db';

        log(`Local database:  ${localDbPath}`, colors.blue);
        log(`Remote database: ${remoteDbPath}`, colors.blue);
        console.log();

        log('Transferring database via SCP...', colors.yellow);

        try {
            const scpCommand = `/usr/bin/scp ${localDbPath} ${remoteDbPath}`;
            execSync(scpCommand, { stdio: 'inherit' });
            log('✅ Database transferred successfully!', colors.green + colors.bright);
        } catch (scpError) {
            throw new Error(`SCP transfer failed: ${scpError.message}`);
        }

        // Summary
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logSection('🎉 Deployment Complete!');
        log(`Total movies updated: ${movieCount}`, colors.green);
        log(`Total time: ${duration} seconds`, colors.green);
        log(`Completed at: ${new Date().toLocaleString()}`, colors.blue);
        console.log('='.repeat(60) + '\n');

        process.exit(0);

    } catch (error) {
        logSection('❌ Error Occurred');
        log(error.message, colors.red);
        log('\nStack trace:', colors.red);
        console.error(error.stack);
        console.log('='.repeat(60) + '\n');
        process.exit(1);
    }
}

// Run the script
main();
