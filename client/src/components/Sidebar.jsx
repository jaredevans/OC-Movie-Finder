import React from 'react';
import './Sidebar.css';

const Sidebar = ({ titles, theaters, selectedTitle, selectedTheater, onSelectTitle, onSelectTheater }) => {
    return (
        <aside className="sidebar fade-in" style={{ animationDelay: '0.15s' }}>
            <section className="sidebar-section">
                <div className="sidebar-heading">
                    <h3>Theaters</h3>
                    {selectedTheater && (
                        <button className="sidebar-clear" onClick={() => onSelectTheater(null)}>Clear</button>
                    )}
                </div>
                <ul className="sidebar-list">
                    {theaters.map((theater) => (
                        <li key={theater.name}>
                            <button
                                className={`sidebar-item ${selectedTheater === theater.name ? 'active' : ''}`}
                                onClick={() => onSelectTheater(selectedTheater === theater.name ? null : theater.name)}
                            >
                                <span className="sidebar-item-text">
                                    <span className="sidebar-item-name">{theater.name}</span>
                                    <span className="sidebar-item-sub">{theater.city}</span>
                                </span>
                                <span className="sidebar-count">{theater.count}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="sidebar-section grow">
                <div className="sidebar-heading">
                    <h3>Movies</h3>
                    {selectedTitle && (
                        <button className="sidebar-clear" onClick={() => onSelectTitle(null)}>Clear</button>
                    )}
                </div>
                <ul className="sidebar-list scrollable">
                    {titles.map(({ title, count }) => (
                        <li key={title}>
                            <button
                                className={`sidebar-item ${selectedTitle === title ? 'active' : ''}`}
                                onClick={() => onSelectTitle(selectedTitle === title ? null : title)}
                            >
                                <span className="sidebar-item-name">{title}</span>
                                <span className="sidebar-count">{count}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </section>
        </aside>
    );
};

export default Sidebar;
