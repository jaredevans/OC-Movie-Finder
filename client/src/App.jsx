import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import SearchBar from './components/SearchBar';
import MovieCard from './components/MovieCard';
import UpdatePage from './pages/UpdatePage';
import './App.css';

function Home() {
  const [movies, setMovies] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiBase = '/ocmovies/api';
        const url = searchTerm
          ? `${apiBase}/movies?q=${encodeURIComponent(searchTerm)}`
          : `${apiBase}/movies`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch movies');
        }
        const data = await response.json();
        setMovies(data.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchMovies();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  return (
    <main>
      <SearchBar value={searchTerm} onChange={setSearchTerm} />

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="movie-grid">
          {movies.length > 0 ? (
            movies.map((movie, index) => (
              <MovieCard key={movie.id} movie={movie} index={index} />
            ))
          ) : (
            <div className="no-results fade-in">
              <p>No movies found matching your search.</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function AppContent() {
  const location = useLocation();
  const [searchClickCount, setSearchClickCount] = useState(0);

  const handleSearchClick = () => {
    setSearchClickCount(prev => prev + 1);
  };

  const isUpdateEnabled = searchClickCount >= 3;

  return (
    <div className="app-container">
      <header className="app-header fade-in">
        <div className="header-content">
          <div className="title-section">
            <h1>OC Movie Finder</h1>
            <p className="subtitle">Find Open Caption screenings near you</p>
          </div>
          <nav className="main-nav">
            <Link
              to="/"
              className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
              onClick={handleSearchClick}
            >
              Search
            </Link>
            {isUpdateEnabled ? (
              <Link to="/update" className={`nav-link ${location.pathname === '/update' ? 'active' : ''}`}>Update</Link>
            ) : (
              <span className="nav-link disabled" title="Click Search tab 3 times to unlock">Update</span>
            )}
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/update" element={<UpdatePage />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router basename="/ocmovies">   {/* <-- add basename */}
      <AppContent />
    </Router>
  );
}

export default App;
