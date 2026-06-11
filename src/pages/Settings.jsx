// src/pages/Settings.jsx
import { useAuth } from '../auth/useAuth.jsx';
import IntegrationsPanel from '../components/IntegrationsPanel.jsx';
import TestModePanel from '../components/TestModePanel.jsx';

export default function Settings() {
  const { isAdmin } = useAuth();

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

      <div className="card" style={{ marginBottom: 16 }} data-tour="storage">
        <span className="eyebrow">Storage: Cloudflare R2 (connected)</span>
        <p style={{ color: 'var(--text-dim)', margin: '8px 0 0', fontSize: 13 }}>
          All uploads land in <code>innsaeit/&#123;client&#125;/&#123;project&#125;/&#123;sku&#125;/</code> on
          Cloudflare R2. Storage uses app-level credentials, so there is nothing to
          connect or reconnect here.
        </p>
      </div>

      <IntegrationsPanel />

      <TestModePanel />

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
