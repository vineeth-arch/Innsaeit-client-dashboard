// src/pages/Settings.jsx
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.jsx';

export default function Settings() {
  const { isAdmin } = useAuth();
  const [params] = useSearchParams();
  const connected = params.get('onedrive') === 'connected';

  if (!isAdmin) {
    return <main className="page"><div className="empty">Settings are admin-only.</div></main>;
  }

  return (
    <main className="page" style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div>
          <p className="eyebrow">Studio</p>
          <h1 className="display">Settings</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <span className="eyebrow">OneDrive storage</span>
        <p style={{ color: 'var(--text-dim)', margin: '8px 0 14px', fontSize: 13 }}>
          All uploads land in <code>/Innsaeit Tracker/&#123;client&#125;/&#123;project&#125;/&#123;sku&#125;/</code> on
          your OneDrive. If your Microsoft password changes or sessions are revoked,
          uploads will fail until you reconnect here. One click fixes it.
        </p>
        {connected && <p className="ok-text" style={{ marginBottom: 12 }}>OneDrive connected successfully.</p>}
        <a className="btn primary" href="/api/onedrive/auth-start">
          {connected ? 'Reconnect OneDrive' : 'Connect OneDrive'}
        </a>
      </div>

      <div className="card">
        <span className="eyebrow">Users</span>
        <p style={{ color: 'var(--text-dim)', margin: '8px 0', fontSize: 13 }}>
          Create users in the Supabase dashboard (Authentication → Users → Add user, with a
          password). Then in the Table Editor open <code>profiles</code> and set their
          <code> role</code> (<code>admin</code> or <code>client</code>) and
          <code> client_id</code>. Two client logins for Hamleys, by design.
        </p>
      </div>
    </main>
  );
}
