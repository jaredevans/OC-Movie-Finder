const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'movies.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database ' + dbPath + ': ' + err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    theater_name TEXT NOT NULL,
    theater_city TEXT NOT NULL,
    theater_state TEXT NOT NULL,
    theater_zip TEXT NOT NULL,
    showtime TEXT NOT NULL,
    url TEXT
  )`);
});

module.exports = db;
