// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.jsx';

export default function Login() {
  const { signIn, session } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) { nav('/'); return null; }

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
      <div className="card login-card">
        <img className="logo" src="/logo.svg" alt="Design Innsaeit"
             onError={(e) => { e.currentTarget.style.display = 'none'; }} />
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

        <button className="btn primary" style={{ width: '100%', marginTop: 6 }}
                onClick={submit} disabled={busy || !email || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {err && <p className="error-text">{err}</p>}
      </div>
    </div>
  );
}
