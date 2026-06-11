// src/components/Layout.jsx
import { Outlet, Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth.jsx';
import { fetchClient, markOnboarded } from '../lib/api.js';
import Topography from './Topography.jsx';
import AnimatedThemeToggler from './AnimatedThemeToggler.jsx';
import Tour from '../onboarding/Tour.jsx';

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth();
  const [client, setClient] = useState(null);
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'dark'
  );
  const [tourOn, setTourOn] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (profile?.client_id) fetchClient(profile.client_id).then(setClient);
  }, [profile?.client_id]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Auto-start the tour once for users who haven't been onboarded. The strict
  // === false check is a safe no-op until the onboarded column exists.
  useEffect(() => {
    if (profile && profile.onboarded === false && !startedRef.current) {
      startedRef.current = true;
      const t = setTimeout(() => setTourOn(true), 600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [profile]);

  function handleTourClose() {
    setTourOn(false);
    if (profile?.onboarded === false) markOnboarded().catch(() => {});
  }

  return (
    <div className="shell">
      <Topography theme={theme} />
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Innsaeit Tracker home">
          <img src="/Horizontal_Wordmark_logo.svg" alt="Innsaeit"
               onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </Link>
        {client && <span className="tenant">{client.theme?.label ?? client.name}</span>}
        {isAdmin && !client && <span className="tenant">Studio Admin</span>}
        <span className="spacer" />
        <button className="btn ghost sm" onClick={() => setTourOn(true)}>Tour</button>
        {isAdmin && <Link to="/settings" className="btn ghost sm">Settings</Link>}
        <AnimatedThemeToggler theme={theme} setTheme={setTheme} />
        <span className="who">{profile?.full_name || profile?.email}</span>
        <button className="btn ghost sm" onClick={signOut}>Sign out</button>
      </header>
      <Outlet />
      {tourOn && <Tour isAdmin={isAdmin} profile={profile} onClose={handleTourClose} />}
    </div>
  );
}
