const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Search endpoint
const scrapeMovies = require('./scraper');

app.get('/api/movies', (req, res) => {
    const { q } = req.query;
    let sql = "SELECT * FROM movies";
    let params = [];

    if (q) {
        // Split search query by spaces
        const searchTerms = q.trim().split(/\s+/);
        const firstWord = searchTerms[0];
        const secondWord = searchTerms[1];

        if (firstWord && secondWord) {
            // First word = movie title, second word = city
            sql += " WHERE title LIKE ? AND theater_city LIKE ?";
            params = [`%${firstWord}%`, `%${secondWord}%`];
        } else if (firstWord) {
            // Only first word provided = search movie title only
            sql += " WHERE title LIKE ?";
            params = [`%${firstWord}%`];
        }
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
