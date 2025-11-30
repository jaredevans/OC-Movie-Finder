# OC Movie Finder - Update and Deploy Script

## Overview

The `update_and_deploy.js` script automates the entire process of updating the movie database and deploying it to production. It performs the following steps:

1. **Scrapes AMC and Regal theaters** for Open Caption showtimes for the next 7 days
2. **Updates the local SQLite database** with the latest showtimes
3. **Transfers the database to production** via SCP

## Theaters Scraped

The script scrapes the following theaters:

- **AMC Montgomery 16** (Bethesda, MD)
- **AMC Georgetown 14** (Washington, DC)
- **Regal Rockville Center** (Rockville, MD)
- **Regal Majestic 20** (Silver Spring, MD)
- **Regal Gallery Place 4DX** (Washington, DC)

## Prerequisites

1. **Node.js** installed (v14 or higher)
2. **SSH access** configured to the production server (`zappy`)
3. **SSH key** set up for passwordless login to `zappy` (recommended)
4. **Required npm packages** installed (run `npm install` in the project root)

## Usage

### Method 1: Using npm script (Recommended)

From the project root directory:

```bash
npm run deploy
```

### Method 2: Direct execution

From the project root directory:

```bash
node server/update_and_deploy.js
```

### Method 3: Direct script execution

From the server directory:

```bash
cd server
./update_and_deploy.js
```

## What to Expect

When you run the script, you'll see:

1. **Scraping Progress**: Real-time updates showing:
   - Which theater is being scraped
   - Which date is being processed
   - Each movie found with its showtime

2. **Database Update Summary**: Total number of showtimes added

3. **SCP Transfer**: Progress of the database transfer to production

4. **Completion Summary**: 
   - Total movies updated
   - Total execution time
   - Completion timestamp

## Example Output

```
============================================================
🎬 OC Movie Finder - Update and Deploy
============================================================
Started at: 11/30/2025, 12:45:39 PM

============================================================
📡 Step 1: Scraping AMC and Regal Theaters
============================================================
This will scrape showtimes for the next 7 days from:
  • AMC Montgomery 16 (Bethesda, MD)
  • AMC Georgetown 14 (Washington, DC)
  • Regal Rockville Center (Rockville, MD)
  • Regal Majestic 20 (Silver Spring, MD)
  • Regal Gallery Place 4DX (Washington, DC)

📍 Starting AMC Montgomery 16 (Bethesda, MD)
  📅 Processing 2025-11-30...
    🎬 Found: Wicked at 2:30pm
    🎬 Found: Gladiator II at 6:45pm
...

✅ Scraping complete! Added 127 showtimes to database.

============================================================
🚀 Step 2: Deploying to Production Server
============================================================
Local database:  /Users/jared/github_projects/OC-Movie-Finder/server/movies.db
Remote database: zappy:/var/www/OC-Movie-Finder/server/movies.db

Transferring database via SCP...
✅ Database transferred successfully!

============================================================
🎉 Deployment Complete!
============================================================
Total movies updated: 127
Total time: 45.23 seconds
Completed at: 11/30/2025, 12:46:24 PM
============================================================
```

## Troubleshooting

### SSH/SCP Issues

If you encounter SSH/SCP errors:

1. **Verify SSH access**: Test your connection to the server
   ```bash
   ssh zappy
   ```

2. **Check SSH keys**: Ensure your SSH key is added to the server's authorized_keys
   ```bash
   ssh-copy-id zappy
   ```

3. **Manual SCP test**: Try transferring a test file manually
   ```bash
   scp /path/to/test.txt zappy:/tmp/test.txt
   ```

### Scraping Issues

If the scraper fails or finds no movies:

1. **Check your internet connection**
2. **Verify theater websites are accessible**
3. **Check for any error messages in the output**
4. **The theaters may have changed their HTML structure** - you may need to update the scraper code

### Database Issues

If database operations fail:

1. **Check file permissions** on the `movies.db` file
2. **Ensure the database isn't locked** by another process
3. **Verify SQLite is installed** and working properly

## Configuration

### Changing the Remote Server

To deploy to a different server, edit the `remoteDbPath` variable in `update_and_deploy.js`:

```javascript
const remoteDbPath = 'your-server:/path/to/movies.db';
```

### Adjusting the Date Range

By default, the script scrapes 7 days ahead. To change this, modify the scraper logic in `scraper.js`:

```javascript
for (let i = 0; i < 7; i++) {  // Change 7 to your desired number of days
```

## Scheduling Automatic Updates

To run this script automatically, you can set up a cron job:

```bash
# Edit crontab
crontab -e

# Add this line to run daily at 3 AM
0 3 * * * cd /Users/jared/github_projects/OC-Movie-Finder && /usr/local/bin/node server/update_and_deploy.js >> /tmp/oc-movie-finder.log 2>&1
```

## Notes

- The script clears all existing data before adding new showtimes to ensure the database is always up-to-date
- Scraping may take a few minutes depending on internet speed and server response times
- The script uses Puppeteer for web scraping, which launches a headless browser
- All progress is logged to the console with color coding for easy monitoring

## Support

For issues or questions, please check:
- Theater website structures haven't changed
- Your SSH configuration is correct
- All npm dependencies are installed
- Node.js version is compatible (v14+)
