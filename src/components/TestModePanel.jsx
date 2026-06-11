// src/components/TestModePanel.jsx
// Admin-only card on the Settings page. Reads and toggles the TEST_MODE flag
// stored in app_settings (Supabase). When on, every outbound email is
// redirected to TEST_MODE_RECIPIENT; all real recipients are dropped + logged.
import { useEffect, useState } from 'react';
import { getTestMode, setTestMode } from '../lib/api.js';

export default function TestModePanel() {
  const [testMode, setLocal] = useState(false);
  const [recipient, setRecipient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    getTestMode()
      .then(({ testMode: tm, recipient: r }) => {
        if (!live) return;
        setLocal(tm);
        setRecipient(r);
      })
      .catch(() => live && setError('Could not load test mode state.'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  async function toggle() {
    const next = !testMode;
    setLocal(next); // optimistic
    setSaving(true);
    setError(null);
    try {
      const { testMode: confirmed } = await setTestMode(next);
      setLocal(confirmed);
    } catch {
      setLocal(!next); // roll back
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="eyebrow" style={{ margin: 0 }}>Email test mode</span>
        {!loading && (
          <span
            className={`int-dot-spacer`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
              color: testMode ? 'var(--amber, #f59e0b)' : 'var(--text-dim)',
            }}
          >
            <span
              style={{
                width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                background: testMode ? 'var(--amber, #f59e0b)' : 'var(--text-dim)',
              }}
            />
            {testMode ? 'ON' : 'off'}
          </span>
        )}
      </div>

      <p style={{ color: 'var(--text-dim)', margin: '8px 0 10px', fontSize: 13 }}>
        When enabled, every outbound email — daily digest and compliance-approved — is
        redirected to the address below. All real recipients are silently dropped and
        logged in Vercel function logs. Email content is unchanged; only the To field
        changes. Disable to resume normal sending.
      </p>

      {loading ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</p>
      ) : (
        <>
          <p style={{ fontSize: 13, margin: '0 0 12px' }}>
            <span style={{ color: 'var(--text-dim)' }}>Test recipient: </span>
            {recipient
              ? <code>{recipient}</code>
              : <span style={{ color: 'var(--amber, #f59e0b)' }}>
                  TEST_MODE_RECIPIENT not set — add it as a Vercel env var
                </span>
            }
          </p>

          <button
            className={`btn sm${testMode ? ' ghost' : ' primary'}`}
            onClick={toggle}
            disabled={saving}
          >
            {saving ? 'Saving…' : testMode ? 'Disable test mode' : 'Enable test mode'}
          </button>
        </>
      )}

      {error && (
        <p style={{ color: 'var(--red, #ef4444)', fontSize: 13, margin: '8px 0 0' }}>{error}</p>
      )}
    </div>
  );
}
