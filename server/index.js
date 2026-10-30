const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Search endpoint
const scrapeMovies = require('./scraper');

// Strip the "(Open Cap/ Eng Sub)" suffix some theaters add, so variants group together
const baseTitle = (title) => title.replace(/\s*\(Open Cap[^)]*\)\s*$/i, '').trim();

app.get('/api/movies', (req, res) => {
    const { q, title, theater } = req.query;
    let sql = "SELECT * FROM movies";
    const conditions = [];
    const params = [];

    if (q) {
        // Split search query by spaces
        const searchTerms = q.trim().split(/\s+/);
        const firstWord = searchTerms[0];
        const secondWord = searchTerms[1];

        if (firstWord) {
            // First word = movie title
            conditions.push("title LIKE ?");
            params.push(`%${firstWord}%`);
        }
        if (secondWord) {
            // Second word = city
            conditions.push("theater_city LIKE ?");
            params.push(`%${secondWord}%`);
        }
    }

    if (title) {
        // Exact base title, including its open caption variants
        conditions.push("(title = ? OR title LIKE ?)");
        params.push(title, `${title} (Open Cap%`);
    }

    if (theater) {
        conditions.push("theater_name = ?");
        params.push(theater);
    }

    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }

    // Order by date
    sql += " ORDER BY showtime ASC";

    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

app.get('/api/filters', (req, res) => {
    db.all("SELECT title, theater_name, theater_city FROM movies", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const titleCounts = new Map();
        const theaters = new Map();
        for (const row of rows) {
            const t = baseTitle(row.title);
            titleCounts.set(t, (titleCounts.get(t) || 0) + 1);

            const existing = theaters.get(row.theater_name);
            if (existing) {
                existing.count++;
            } else {
                theaters.set(row.theater_name, { name: row.theater_name, city: row.theater_city, count: 1 });
            }
        }

        const titles = [...titleCounts]
            .map(([title, count]) => ({ title, count }))
            .sort((a, b) => a.title.localeCompare(b.title));

        res.json({
            titles,
            theaters: [...theaters.values()].sort((a, b) => a.name.localeCompare(b.name)),
        });
    });
});

app.get('/api/date-range', (req, res) => {
    db.get("SELECT MIN(showtime) as min_date, MAX(showtime) as max_date FROM movies", (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row);
    });
});

app.get('/api/scrape', async (req, res) => {
    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial connection success
    res.write('data: {"type":"connected"}\n\n');

    try {
        const count = await scrapeMovies((progressData) => {
            // Stream progress events to client
            res.write(`data: ${JSON.stringify(progressData)}\n\n`);
        });

        // Send completion event
        res.write(`data: ${JSON.stringify({ type: 'complete', count })}\n\n`);
        res.end();
    } catch (error) {
        console.error(error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Scraping failed' })}\n\n`);
        res.end();
    }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
