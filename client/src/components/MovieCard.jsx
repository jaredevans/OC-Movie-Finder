import React from 'react';
import './MovieCard.css';

const MovieCard = ({ movie, index }) => {
    const date = new Date(movie.showtime);
    const formattedDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const formattedTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    const getRelativeTime = (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const movieDate = new Date(date);
        movieDate.setHours(0, 0, 0, 0);

        const diffTime = movieDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return '(Today)';
        if (diffDays === 1) return '(Tomorrow)';
        if (diffDays > 1) return `(in ${diffDays} days)`;
        return '';
    };

    const relativeTime = getRelativeTime(date);

    return (
        <div className="movie-card fade-in" style={{ animationDelay: `${0.2 + (index * 0.05)}s` }}>
            <div className="movie-content">
                <div className="movie-header">
                    <h2 className="movie-title">{movie.title}</h2>
                    <span className="movie-badge">OC</span>
                </div>
                <div className="movie-details">
                    <div className="detail-row">
                        <svg xmlns="http://www.w3.org/2000/svg" className="detail-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                        <span>{formattedDate} at {formattedTime} <span className="relative-time">{relativeTime}</span></span>
                    </div>
                    <div className="detail-row">
                        <svg xmlns="http://www.w3.org/2000/svg" className="detail-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        <span>{movie.theater_name}</span>
                    </div>
                    <div className="detail-row location">
                        <span>{movie.theater_city}, {movie.theater_state} {movie.theater_zip}</span>
                    </div>
                </div>
                <a
                    href={movie.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="book-btn"
                >
                    Get Tickets
                </a>
            </div>
        </div>
    );
};

export default MovieCard;
