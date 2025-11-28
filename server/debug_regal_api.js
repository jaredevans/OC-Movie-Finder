// debug_regal_api.js
// Directly hit Regal's API and print OC-related info

const https = require('https');

const THEATRE_CODE = '0336';
const DATE = '11-29-2025'; // MM-DD-YYYY
const API_URL = `https://www.regmovies.com/api/getShowtimes?theatres=${THEATRE_CODE}&date=${DATE}&hoCode=&ignoreCache=false&moviesOnly=false`;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(
              new Error(`Status ${res.statusCode}: ${data.slice(0, 200)}...`)
            );
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('GET', API_URL, '\n');

  try {
    const apiData = await fetchJson(API_URL);

    console.log('shows length:', apiData.shows?.length || 0);
    if (!apiData.shows?.length) {
      console.log('No shows in payload.');
      process.exit(0);
    }

    const films = Array.isArray(apiData.shows[0].Film)
      ? apiData.shows[0].Film
      : [];

    console.log('Film count:', films.length);
    console.log(
      'Film titles:',
      films.map((f) => f.Title)
    );

    const ocMovies = [];

    for (const movie of films) {
      const title = movie.Title;
      const perfs = movie.Performances || [];
      for (const perf of perfs) {
        const attrs = perf.PerformanceAttributes || [];
        if (attrs.includes('OC')) {
          ocMovies.push({
            title,
            attributes: attrs,
            calendarShowTime: perf.CalendarShowTime,
          });
        }
      }
    }

    console.log('\nOC movies from API:');
    if (!ocMovies.length) {
      console.log('(none)');
    } else {
      ocMovies.forEach((m, i) => {
        console.log(
          `${i + 1}. ${m.title} @ ${m.calendarShowTime} [${m.attributes.join(
            ', '
          )}]`
        );
      });
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
