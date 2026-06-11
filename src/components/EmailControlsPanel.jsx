// src/components/EmailControlsPanel.jsx
// Admin-only Settings card with two email controls, both stored in the
// app_settings table (Supabase) and read server-side:
//   - Daily digests: pause/resume the scheduled digest cron.
//   - Test mode: redirect every outbound email to TEST_MODE_RECIPIENT.
import { useEffect, useState } from 'react';
import { getFlags, setFlag } from '../lib/api.js';

// Small amber/dim status pill matching the IntegrationsPanel dot style.
function Pill({ on, onLabel, offLabel }) {
  const color = on ? 'var(--amber, #f59e0b)' : 'var(--text-dim)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', color,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', background: color }} />
      {on ? onLabel : offLabel}
    </span>
  );
}

export default function EmailControlsPanel() {
  const [flags, setFlags] = useState({ testMode: false, digestsPaused: false, recipient: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // which key is in-flight
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    getFlags()
      .then((f) => live && setFlags(f))
      .catch(() => live && setError('Could not load email settings.'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  // key: 'digestsPaused' | 'testMode' ; flagKey: server key
  async function toggle(key, flagKey) {
    const next = !flags[key];
    setFlags((f) => ({ ...f, [key]: next })); // optimistic
    setSaving(key);
    setError(null);
    try {
      const updated = await setFlag(flagKey, next);
      setFlags(updated);
    } catch {
      setFlags((f) => ({ ...f, [key]: !next })); // roll back
      setError('Failed to save. Try again.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <span className="eyebrow">Email controls</span>

      {loading ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '8px 0 0' }}>Loading…</p>
      ) : (
        <>
          {/* ---- Daily digests ---- */}
          <div style={{ borderTop: '1px solid var(--border, #2a2a2a)', marginTop: 10, paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 14 }}>Daily digests</strong>
              <Pill on={flags.digestsPaused} onLabel="PAUSED" offLabel="active" />
            </div>
            <p style={{ color: 'var(--text-dim)', margin: '6px 0 10px', fontSize: 13 }}>
              The scheduled daily digest (admins, supervisor, buyers, checkers) runs every
              morning. Pause to stop all digests on demand; compliance-approved
              notifications still send. Resume any time.
            </p>
            <button
              className={`btn sm${flags.digestsPaused ? ' primary' : ' ghost'}`}
              onClick={() => toggle('digestsPaused', 'digests_paused')}
              disabled={saving === 'digestsPaused'}
            >
              {saving === 'digestsPaused'
                ? 'Saving…'
                : flags.digestsPaused ? 'Resume daily digests' : 'Pause daily digests'}
            </button>
          </div>

          {/* ---- Test mode ---- */}
          <div style={{ borderTop: '1px solid var(--border, #2a2a2a)', marginTop: 16, paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 14 }}>Test mode</strong>
              <Pill on={flags.testMode} onLabel="ON" offLabel="off" />
            </div>
            <p style={{ color: 'var(--text-dim)', margin: '6px 0 10px', fontSize: 13 }}>
              When on, every outbound email — daily digest and compliance-approved — is
              redirected to the address below. All real recipients are silently dropped and
              logged in Vercel function logs. Content is unchanged; only the To field changes.
            </p>
            <p style={{ fontSize: 13, margin: '0 0 12px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Test recipient: </span>
              {flags.recipient
                ? <code>{flags.recipient}</code>
                : <span style={{ color: 'var(--amber, #f59e0b)' }}>
                    TEST_MODE_RECIPIENT not set — add it as a Vercel env var
                  </span>
              }
            </p>
            <button
              className={`btn sm${flags.testMode ? ' ghost' : ' primary'}`}
              onClick={() => toggle('testMode', 'test_mode')}
              disabled={saving === 'testMode'}
            >
              {saving === 'testMode'
                ? 'Saving…'
                : flags.testMode ? 'Disable test mode' : 'Enable test mode'}
            </button>
          </div>
        </>
      )}

      {error && (
        <p style={{ color: 'var(--red, #ef4444)', fontSize: 13, margin: '10px 0 0' }}>{error}</p>
      )}
    </div>
  );
}
