const db = require('./db');

const movies = [
    {
        title: 'Wicked',
        theater_name: 'AMC Empire 25',
        theater_city: 'New York',
        theater_state: 'NY',
        theater_zip: '10036',
        showtime: '2024-11-27 19:00:00'
    },
    {
        title: 'Gladiator II',
        theater_name: 'Regal Union Square',
        theater_city: 'New York',
        theater_state: 'NY',
        theater_zip: '10003',
        showtime: '2024-11-27 20:30:00'
    },
    {
        title: 'Moana 2',
        theater_name: 'Alamo Drafthouse Brooklyn',
        theater_city: 'Brooklyn',
        theater_state: 'NY',
        theater_zip: '11201',
        showtime: '2024-11-28 14:00:00'
    },
    {
        title: 'Wicked',
        theater_name: 'AMC Lincoln Square 13',
        theater_city: 'New York',
        theater_state: 'NY',
        theater_zip: '10023',
        showtime: '2024-11-28 18:00:00'
    },
    {
        title: 'Red One',
        theater_name: 'AMC Magic Johnson Harlem 9',
        theater_city: 'New York',
        theater_state: 'NY',
        theater_zip: '10027',
        showtime: '2024-11-29 16:45:00'
    },
    {
        title: 'Conclave',
        theater_name: 'Angelika Film Center',
        theater_city: 'New York',
        theater_state: 'NY',
        theater_zip: '10012',
        showtime: '2024-11-27 15:00:00'
    }
];

db.serialize(() => {
    // Clear existing data
    db.run("DELETE FROM movies", (err) => {
        if (err) {
            console.error("Error clearing table:", err.message);
            return;
        }
        console.log("Cleared movies table.");

        const stmt = db.prepare("INSERT INTO movies (title, theater_name, theater_city, theater_state, theater_zip, showtime) VALUES (?, ?, ?, ?, ?, ?)");

        movies.forEach(movie => {
            stmt.run(movie.title, movie.theater_name, movie.theater_city, movie.theater_state, movie.theater_zip, movie.showtime);
        });

        stmt.finalize(() => {
            console.log("Seeded " + movies.length + " movies.");
            db.close();
        });
    });
});
