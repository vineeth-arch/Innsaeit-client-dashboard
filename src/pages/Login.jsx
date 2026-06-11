// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.jsx';
import Ripple from '../components/Ripple.jsx';
import InteractiveHoverButton from '../components/InteractiveHoverButton.jsx';

export default function Login() {
  const { signIn, session } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function submit() {
    setErr(''); setBusy(true);
    try {
      await signIn(email.trim(), password);
      nav('/');
    } catch (e) {
      setErr(e.message === 'Invalid login credentials'
        ? 'Email or password is incorrect.'
        : e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <Ripple />
      <div className="login-stack">
        <img className="logo login-logo" src="/Horizontal_Wordmark_logo.svg" alt="Innsaeit"
             onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <div className="card login-card">
          <h1 className="display">Artwork Tracker</h1>
          <p className="sub">Sign in to view the live status of every SKU.</p>

          <div className="field">
            <label className="eyebrow" htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username"
                   value={email} onChange={(e) => setEmail(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </div>
          <div className="field">
            <label className="eyebrow" htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password"
                   value={password} onChange={(e) => setPassword(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </div>

          <InteractiveHoverButton style={{ width: '100%', marginTop: 6 }}
                  onClick={submit} disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </InteractiveHoverButton>
          {err && <p className="error-text">{err}</p>}
        </div>
      </div>
    </div>
  );
}
