# OC Movie Finder

A web app for finding Open Caption (OC) and subtitled movie showtimes at nearby theaters in the Washington DC / Maryland area. It scrapes AMC and Regal theater listings, stores results in SQLite, and provides a React UI to search and browse upcoming screenings.

<img src="https://i.imgur.com/npd0uUQ.png">
<img src="https://i.imgur.com/VMDKhsA.png">

## Stack

- **Server:** Node.js, Express, SQLite (`server/movies.db`)
- **Client:** React 19, Vite, React Router
- **Scraping:** AMC official API, Regal via Puppeteer + stealth plugin
- **Real-time updates:** Server-Sent Events (SSE)

## How the scraper works

The scraper (`server/scraper.js`) fetches OC/subtitled showtimes for the next 7 days from 5 theaters. AMC and Regal use completely different approaches:

### AMC — Official API

AMC exposes a public API at `api.amctheatres.com`. The scraper makes direct HTTPS requests with an API key (`X-AMC-Vendor-Key` header). For each theater and date, it calls:

```
GET /v2/theatres/{amcId}/showtimes/{date}?page-size=200
```

Each showtime in the response has an `attributes` array. The scraper checks for attribute codes like `OPENCAPTION`, `SPANISHENGLISHSUBTITLE`, `ENGLISHSUBTITLE`, `SUBTITLED`, etc. It also does a keyword fallback on the attribute `name` field for strings like "open caption" or "subtitle".

### Regal — Puppeteer + Internal API

Regal's API returns 403 for direct HTTP requests — it requires cookies/tokens from a browser session. The scraper launches a headless Chromium browser via Puppeteer with a stealth plugin to avoid bot detection, navigates to the theater page, then calls Regal's internal API from within the browser context:

```
GET /api/getShowtimes?theatres={code}&date={date}
```

Each performance in the response has a `PerformanceAttributes` array. The scraper filters for entries containing `'OC'`. Movie titles with the `(Open Cap/Eng Sub)` suffix are cleaned up before storage.

### Theaters

| Theater | Chain | Location |
|---------|-------|----------|
| AMC Montgomery 16 | AMC | Bethesda, MD |
| AMC Georgetown 14 | AMC | Washington, DC |
| Regal Rockville Center | Regal | Rockville, MD |
| Regal Majestic 20 | Regal | Silver Spring, MD |
| Regal Gallery Place 4DX | Regal | Washington, DC |

## Local development

**Prerequisites:** Node.js 18+, npm

1. Install dependencies:
   ```
   npm install
   npm install --prefix client
   ```

2. Create a `.env` file in the project root:
   ```
   AMC_API_KEY=your_amc_api_key
   ```

3. Run both servers:
   ```
   npm run dev
   ```
   - API: `http://127.0.0.1:3001/api`
   - UI: `http://localhost:5173/ocmovies/`

   Vite proxies `/ocmovies/api` to the Express server. You can also run them separately with `npm run server` and `npm run client`.

4. The database is created at `server/movies.db` on first server start.

## Updating showtimes

- **Via UI:** Navigate to the Update page and click **Run Update**. Progress streams in real time via SSE showing each theater, date, and movie as they're found.
- **Via CLI:** `node server/run_scraper.js` runs the scraper directly (clears and repopulates the database).
- **Update + deploy:** `node server/update_and_deploy.js` runs the scraper then SCPs the database to the production server.

## API endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/movies` | All OC showtimes, sorted by date |
| `GET /api/movies?q=term` | Search by title; a second word filters by city (e.g., `dune bethesda`) |
| `GET /api/scrape` | Triggers a scrape, streams SSE events: `connected`, `theater`, `date`, `movie`, `complete`, `error` |

In production these are served under `/ocmovies/api/`.

## Test scripts

Located in `server/`:

- `test_one_oc_amc.js` — Calls the AMC API and stops after finding the first OC/subtitled movie. Does not modify the database.
- `test_one_oc_regal.js` — Launches Puppeteer and stops after finding the first OC movie from Regal. Does not modify the database.

## Deployment

1. Build the client:
   ```
   npm run build --prefix client
   ```
   Output goes to `client/dist/` with the `/ocmovies/` base path baked in.

2. Configure your reverse proxy to:
   - Serve `client/dist/` at `/ocmovies/`
   - Proxy `/ocmovies/api/` to `http://127.0.0.1:3001/api/`

   See `server/nginx_sample_config.txt` for a working Nginx config with SSE-friendly settings.

3. Start the API server:
   ```
   npm run server
   ```

## Troubleshooting

- **Puppeteer won't launch:** Set `PUPPETEER_EXECUTABLE_PATH` to a local Chrome/Chromium binary, or install missing system libraries.
- **Regal returns no results:** The stealth plugin or user-agent may need updating if Regal changes their bot detection.
- **AMC returns errors:** Verify the `AMC_API_KEY` in `.env` is valid.
- **Adding theaters:** Edit the `theaters` array in `server/scraper.js`. AMC theaters need an `amcId`, Regal theaters need a URL containing the theater code.
