import React, { useState } from 'react';
import './UpdatePage.css';

const UpdatePage = () => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [result, setResult] = useState(null);
    const [progressLog, setProgressLog] = useState([]);
    const [currentTheater, setCurrentTheater] = useState('');
    const [currentDate, setCurrentDate] = useState('');
    const [moviesFound, setMoviesFound] = useState(0);

    const theaters = [
        { name: 'AMC Montgomery 16', location: 'Bethesda, MD', chain: 'AMC' },
        { name: 'AMC Georgetown 14', location: 'Washington, DC', chain: 'AMC' },
        { name: 'Regal Rockville Center', location: 'Rockville, MD', chain: 'Regal' },
        { name: 'Regal Majestic 20', location: 'Silver Spring, MD', chain: 'Regal' },
        { name: 'Regal Gallery Place 4DX', location: 'Washington, DC', chain: 'Regal' }
    ];

    const handleUpdate = async () => {
        setLoading(true);
        setStatus('Initializing scraper...');
        setResult(null);
        setProgressLog([]);
        setMoviesFound(0);

        try {
            const eventSource = new EventSource('http://localhost:3001/api/scrape', {
                withCredentials: false
            });

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);

                switch (data.type) {
                    case 'connected':
                        setStatus('Connected to scraper');
                        break;

                    case 'theater':
                        setCurrentTheater(data.theater);
                        setCurrentDate('');
                        setStatus(`Scraping ${data.theater}...`);
                        setProgressLog(prev => [...prev, {
                            type: 'theater',
                            message: `📍 Starting ${data.theater} (${data.location})`,
                            timestamp: new Date().toLocaleTimeString()
                        }]);
                        break;

                    case 'date':
                        setCurrentDate(data.date);
                        setStatus(`Processing ${new Date(data.date).toLocaleDateString()}...`);
                        break;

                    case 'movie':
                        setMoviesFound(prev => prev + 1);
                        setProgressLog(prev => [...prev, {
                            type: 'movie',
                            message: `🎬 ${data.title}`,
                            showtime: data.showtime,
                            theater: data.theater,
                            timestamp: new Date().toLocaleTimeString()
                        }]);
                        break;

                    case 'complete':
                        setStatus('Complete');
                        setResult(`Successfully updated database with ${data.count} movies.`);
                        setLoading(false);
                        eventSource.close();
                        break;

                    case 'error':
                        setStatus('Error: ' + data.message);
                        setLoading(false);
                        eventSource.close();
                        break;
                }
            };

            eventSource.onerror = (error) => {
                console.error('EventSource error:', error);
                setStatus('Connection error');
                setLoading(false);
                eventSource.close();
            };

        } catch (error) {
            setStatus('Error: ' + error.message);
            setLoading(false);
        }
    };

    return (
        <div className="update-container fade-in">
            <div className="update-card">
                <h2>Update Database</h2>
                <p>
                    Click below to scrape Open Caption showtimes for the next 7 days from the following theaters:
                </p>

                <div className="theaters-list">
                    {theaters.map((theater, index) => (
                        <div key={index} className="theater-item">
                            <div className="theater-icon">{theater.chain === 'AMC' ? '🎬' : '🎞️'}</div>
                            <div className="theater-info">
                                <div className="theater-name">{theater.name}</div>
                                <div className="theater-location">{theater.location}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    className={`update-btn ${loading ? 'loading' : ''}`}
                    onClick={handleUpdate}
                    disabled={loading}
                >
                    {loading ? 'Updating...' : 'Run Update'}
                </button>

                {status && (
                    <div className="status-message">
                        <div className={`status-indicator ${loading ? 'pulse' : ''}`}></div>
                        <span>{status}</span>
                        {moviesFound > 0 && <span className="movies-count">({moviesFound} movies found)</span>}
                    </div>
                )}

                {progressLog.length > 0 && (
                    <div className="progress-log">
                        <h3>Progress Log</h3>
                        <div className="log-entries">
                            {progressLog.map((entry, index) => (
                                <div key={index} className={`log-entry ${entry.type}`}>
                                    <span className="log-time">{entry.timestamp}</span>
                                    <span className="log-message">{entry.message}</span>
                                    {entry.showtime && <span className="log-showtime">{entry.showtime}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {result && (
                    <div className="result-message success">
                        <svg xmlns="http://www.w3.org/2000/svg" className="result-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {result}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpdatePage;
