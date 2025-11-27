# OC Movie Finder

A small web app for quickly finding Open Caption (OC) movie showtimes. The app scrapes nearby AMC and Regal theater listings, stores the results in SQLite, and exposes a simple React UI to search and browse screenings.

<img src="https://i.imgur.com/npd0uUQ.png">

<img src="https://i.imgur.com/VMDKhsA.png">

## Features
- Searchable list of Open Caption screenings with date/time and theater details (search by title only or `title city`)
- One-click "Get Tickets" links back to the theater listing
- Built-in update page that runs the scraper and streams progress via Server-Sent Events
- 7-day window of showtimes, refreshed on each scrape (database is cleared before re-populating)

## How it works
- **Scraper**: `server/scraper.js` uses Puppeteer (with a stealth plugin) to visit AMC and Regal showtime pages for the next 7 days, filtering only Open Caption showings.
- **Storage**: Results are persisted in a local SQLite DB (`server/movies.db`, created automatically on first run).
- **API**: `server/index.js` serves movie data at `/api/movies` (optional `?q=` search) and exposes `/api/scrape` to trigger a scrape and stream progress.
- **Client**: Vite/React front end (`client/`) fetches movie data, supports text search, and offers an Update page that calls `/api/scrape` and shows progress in real time.

## Prerequisites
- Node.js 18+ and npm
- macOS/Linux/Windows with Chromium deps to run Puppeteer (Puppeteer downloads its own Chromium)

## Quick start
1. Install server deps: `npm install`
2. Install client deps: `cd client && npm install`
3. From the project root, run both server and client: `npm run dev` (uses `concurrently`)
   - Server runs on `http://localhost:3001`
   - Client runs on `http://localhost:5173`
   - Prefer `npm run server` / `npm run client` if you need to run them separately
4. The database file will appear at `server/movies.db` after the first scrape or server start.

## Updating showtimes
- In the client, open the **Update** tab and click **Run Update**. The UI listens to `/api/scrape` via SSE and shows theater/date progress plus movie discoveries.
- The scraper clears existing rows in `movies` before inserting fresh results.
- Supported theaters (as of now): AMC Montgomery 16, AMC Georgetown 14, Regal Rockville Center, Regal Majestic 20, Regal Gallery Place 4DX.

## API reference
- `GET /api/movies` – returns all stored OC showings sorted by showtime.
- `GET /api/movies?q=term` – search by movie title; a second word is treated as a city filter (e.g., `dune bethesda`).
- `GET /api/scrape` – triggers a scrape and streams JSON events (`connected`, `theater`, `date`, `movie`, `complete`, `error`).

## Manual scraping
- Run headless without the client: `node server/run_scraper.js`.
- Or stream results over SSE directly: `curl -N http://localhost:3001/api/scrape`.

## Project layout
- `server/` – Express API, Puppeteer scraper, SQLite DB file (`movies.db`).
- `client/` – React app (Vite) with search UI and update page.
- `package.json` – root scripts to run server/client together with `npm run dev`.

## Notes & troubleshooting
- If Puppeteer fails to launch, set `PUPPETEER_EXECUTABLE_PATH` to a local Chrome/Chromium binary or install missing system libs.
- Scraping relies on AMC/Regal markup; if the sites change, selectors in `server/scraper.js` may need updates.
- The app currently targets the DC/MD theaters listed above; add more theaters in `server/scraper.js` as needed.
