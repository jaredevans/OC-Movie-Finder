# OC Movie Finder

A small web app for quickly finding Open Caption (OC) movie showtimes. The app scrapes nearby AMC and Regal theater listings, stores the results in SQLite, and exposes a React UI to search and browse screenings. Both the UI and API are served under the `/ocmovies` path so they can live behind a reverse proxy.

<img src="https://i.imgur.com/npd0uUQ.png">
<img src="https://i.imgur.com/VMDKhsA.png">

## Stack at a glance
- Puppeteer + stealth plugin scraper (`server/scraper.js`) pulls the next 7 days of OC showings.
- Express API at `/api/...` (proxied as `/ocmovies/api/...`) backed by SQLite in `server/movies.db`.
- React + Vite client (`client/`) with `/ocmovies/` base path and an Update page that streams scraper progress via SSE.

## Local development
Prereqs: Node.js 18+, npm, and Chromium deps for Puppeteer (it downloads its own Chromium).

1) Install server deps: `npm install`  
2) Install client deps: `npm install --prefix client`  
3) Run both servers: `npm run dev`  
   - API: `http://127.0.0.1:3001/api`  
   - UI: `http://localhost:5173/ocmovies/` (Vite proxies `/ocmovies/api` → `http://127.0.0.1:3001/api`)  
   - Prefer `npm run server` / `npm run client` if you need to run them separately.  
4) The database file is created at `server/movies.db` after the first scrape or server start.

## Updating showtimes
- In the client, open **Update** and click **Run Update**. The UI connects to `/ocmovies/api/scrape` via SSE and shows theater/date progress plus movie discoveries.
- CLI option: `node server/run_scraper.js` (clears existing rows and repopulates the 7-day window).
- Current theaters: AMC Montgomery 16, AMC Georgetown 14, Regal Rockville Center, Regal Majestic 20, Regal Gallery Place 4DX.

## API reference
- `GET /api/movies` (or `/ocmovies/api/movies` when proxied) – all OC showings sorted by showtime.
- `GET /api/movies?q=term` – search by movie title; a second word is treated as a city filter (e.g., `dune bethesda`).
- `GET /api/scrape` – triggers a scrape and streams JSON events (`connected`, `theater`, `date`, `movie`, `complete`, `error`).

## Deployment notes
- Build the client with `npm run build --prefix client`; output lives in `client/dist` and already assumes the `/ocmovies/` base path.
- Serve `client/dist` at `/ocmovies/` and reverse proxy `/ocmovies/api/` → `http://127.0.0.1:3001/api/`. See `server/nginx_sample_config.txt` for a working Nginx snippet (includes SSE-friendly settings and a `/ocmovies` → `/ocmovies/` redirect).
- Run the API with `npm run server` (listens on 127.0.0.1:3001 by default).

## Troubleshooting
- If Puppeteer fails to launch, set `PUPPETEER_EXECUTABLE_PATH` to a local Chrome/Chromium binary or install missing system libs.
- Scraping depends on AMC/Regal markup; update selectors or the Regal API call in `server/scraper.js` if the sites change.
- Add more theaters in `server/scraper.js` as needed.
