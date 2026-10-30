import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import SearchBar from './components/SearchBar';
import MovieCard from './components/MovieCard';
import Sidebar from './components/Sidebar';
import UpdatePage from './pages/UpdatePage';
import './App.css';

function Home() {
  const [movies, setMovies] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTitle, setSelectedTitle] = useState(null);
  const [selectedTheater, setSelectedTheater] = useState(null);
  const [filters, setFilters] = useState({ titles: [], theaters: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const response = await fetch('/ocmovies/api/filters');
        const data = await response.json();
        setFilters({ titles: data.titles || [], theaters: data.theaters || [] });
      } catch {
        // silently fail
      }
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (searchTerm) params.set('q', searchTerm);
        if (selectedTitle) params.set('title', selectedTitle);
        if (selectedTheater) params.set('theater', selectedTheater);
        const query = params.toString();
        const url = `/ocmovies/api/movies${query ? `?${query}` : ''}`;

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
  }, [searchTerm, selectedTitle, selectedTheater]);

  // Typing a new search replaces any movie picked from the sidebar
  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setSelectedTitle(null);
  };

  const handleSelectTitle = (title) => {
    setSelectedTitle(title);
    setSearchTerm('');
  };

  return (
    <main className="home-layout">
      <div className="home-search">
        <SearchBar value={searchTerm} onChange={handleSearchChange} />
      </div>

      <Sidebar
        titles={filters.titles}
        theaters={filters.theaters}
        selectedTitle={selectedTitle}
        selectedTheater={selectedTheater}
        onSelectTitle={handleSelectTitle}
        onSelectTheater={setSelectedTheater}
      />

      <div className="home-results">
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
      </div>
    </main>
  );
}

function AppContent() {
  const location = useLocation();
  const [searchClickCount, setSearchClickCount] = useState(0);
  const [dateRange, setDateRange] = useState('');

  const handleSearchClick = () => {
    setSearchClickCount(prev => prev + 1);
  };

  useEffect(() => {
    const fetchDateRange = async () => {
      try {
        const response = await fetch('/ocmovies/api/date-range');
        const data = await response.json();
        if (data.min_date && data.max_date) {
          const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          setDateRange(`${fmt(data.min_date)} – ${fmt(data.max_date)}`);
        }
      } catch (err) {
        // silently fail
      }
    };
    fetchDateRange();
  }, []);

  const isUpdateEnabled = searchClickCount >= 3;

  return (
    <div className="app-container">
      <header className="app-header fade-in">
        <div className="header-content">
          <div className="title-section">
            <h1>OC Movie Finder</h1>
            <p className="subtitle">Find Open Caption screenings near you</p>
            {dateRange && <p className="date-range">{dateRange}</p>}
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
