// src/components/Layout.jsx
import { Outlet, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth.jsx';
import { fetchClient } from '../lib/api.js';

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth();
  const [client, setClient] = useState(null);
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'dark'
  );

  useEffect(() => {
    if (profile?.client_id) fetchClient(profile.client_id).then(setClient);
  }, [profile?.client_id]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Innsaeit Tracker home">
          <img src="/Logo_wordmark_teal%20full.svg" alt="Design Innsaeit"
               onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </Link>
        {client && <span className="tenant">{client.name} Tracker</span>}
        {isAdmin && !client && <span className="tenant">Studio Admin</span>}
        <span className="spacer" />
        {isAdmin && <Link to="/settings" className="btn ghost sm">Settings</Link>}
        <button
          className="btn ghost sm theme-toggle"
          aria-label="Toggle light/dark theme"
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
        <span className="who">{profile?.full_name || profile?.email}</span>
        <button className="btn ghost sm" onClick={signOut}>Sign out</button>
      </header>
      <Outlet />
    </div>
  );
}
