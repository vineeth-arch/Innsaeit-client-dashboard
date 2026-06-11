// src/components/IntegrationsPanel.jsx
// Status + quick-links dashboard for the app's external services. It NEVER
// displays, accepts, or stores any API key or secret — only a live status dot
// (from admin-only /api/health/* booleans) and deep links to where each key is
// rotated. All actual secrets live in Vercel env vars.
import { useEffect, useState } from 'react';
import { checkIntegration } from '../lib/api.js';

// Services with a server-side health check. Each runs on mount, in parallel,
// in its own try/catch so one failing service never blanks the others.
const CHECKS = ['r2', 'resend', 'supabase'];

const INTEGRATIONS = [
  {
    key: 'r2',
    name: 'Cloudflare R2',
    sub: 'File storage',
    note: 'Rotate the R2 token here, then update R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY in Vercel and redeploy.',
    links: [
      { label: 'Manage / Get key', href: 'https://dash.cloudflare.com/?to=/:account/r2/api-tokens' },
      { label: 'Bucket settings', href: 'https://dash.cloudflare.com/?to=/:account/r2/overview' },
    ],
  },
  {
    key: 'resend',
    name: 'Resend',
    sub: 'Email',
    note: 'Rotate the key here, update RESEND_API_KEY in Vercel, redeploy.',
    links: [
      { label: 'Get / manage key', href: 'https://resend.com/api-keys' },
      { label: 'Domain / DNS status', href: 'https://resend.com/domains' },
    ],
  },
  {
    key: 'supabase',
    name: 'Supabase',
    sub: 'Database & auth',
    note: 'Service role key lives in Vercel only; never paste it anywhere else.',
    links: [
      { label: 'Manage keys', href: 'https://supabase.com/dashboard/project/hocvnneblgsvtujoqhpo/settings/api' },
      { label: 'SQL editor', href: 'https://supabase.com/dashboard/project/hocvnneblgsvtujoqhpo/sql/new' },
    ],
  },
  {
    key: 'vercel',
    name: 'Vercel',
    sub: 'Environment variables',
    note: 'All API keys are set here. Change a key in its own dashboard, then update the matching variable here and redeploy.',
    links: [
      { label: 'Environment variables', href: 'https://vercel.com/vineeth-archs-projects/innsaeit-client-dashboard/settings/environment-variables' },
    ],
  },
  {
    key: 'github',
    name: 'GitHub',
    sub: 'Code',
    note: 'Source. Pushes here auto-deploy to Vercel.',
    links: [
      { label: 'Repository', href: 'https://github.com/vineeth-arch/Innsaeit-client-dashboard' },
    ],
  },
];

const STATE_META = {
  loading:      { color: 'grey',  label: 'Checking…' },
  ok:           { color: 'green', label: 'Connected' },
  warn:         { color: 'amber', label: 'Domain unverified' },
  fail:         { color: 'red',   label: 'Check failed' },
  unconfigured: { color: 'red',   label: 'Not configured' },
};

function StatusDot({ state }) {
  // Services without a health check (Vercel, GitHub) render a neutral spacer so
  // rows stay aligned, with no misleading status claim.
  if (!state) {
    return <span className="int-dot-spacer" aria-hidden="true" />;
  }
  const { color, label } = STATE_META[state] || STATE_META.fail;
  return (
    <span className="int-status" title={label}>
      <span className={`int-dot ${color}`} aria-hidden="true" />
      <span className={`int-state ${color}`}>{label}</span>
    </span>
  );
}

export default function IntegrationsPanel() {
  const [status, setStatus] = useState(
    () => Object.fromEntries(CHECKS.map((k) => [k, 'loading'])),
  );

  useEffect(() => {
    let live = true;
    CHECKS.forEach(async (key) => {
      try {
        const r = await checkIntegration(key);
        let state = 'fail';
        if (r.configured === false) state = 'unconfigured';
        else if (r.ok && key === 'resend' && r.domainVerified === false) state = 'warn';
        else if (r.ok) state = 'ok';
        if (live) setStatus((s) => ({ ...s, [key]: state }));
      } catch {
        if (live) setStatus((s) => ({ ...s, [key]: 'fail' }));
      }
    });
    return () => { live = false; };
  }, []);

  return (
    <div className="card" style={{ marginBottom: 16 }} data-tour="integrations">
      <span className="eyebrow">Integrations</span>
      <p style={{ color: 'var(--text-dim)', margin: '8px 0 6px', fontSize: 13 }}>
        Live status and quick links for the services this app depends on. Keys are
        never shown here — they live only in Vercel. Rotate a key in its own
        dashboard, then update the matching variable in Vercel and redeploy.
      </p>

      <div className="int-list">
        {INTEGRATIONS.map((it) => (
          <div className="int-row" key={it.key}>
            <StatusDot state={status[it.key]} />
            <div className="int-main">
              <div className="int-head">
                <span className="int-name">{it.name}</span>
                <span className="int-sub">{it.sub}</span>
              </div>
              <p className="int-note">{it.note}</p>
              <div className="int-links">
                {it.links.map((l) => (
                  <a className="btn sm" key={l.href} href={l.href} target="_blank" rel="noreferrer">
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
