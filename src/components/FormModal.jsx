// src/components/FormModal.jsx
// Wraps the overlay+modal pattern for forms and owns the form chrome: a title
// plus Cancel/Save action rows at BOTH the top and bottom. While `dirty`, an
// accidental outside-click or Escape asks before discarding instead of closing
// silently, and reload/tab-close is covered by a native beforeunload prompt.
// "Stay on this page" is the primary, autofocused option, so Enter keeps the form.
import { useEffect, useState } from 'react';

export function useUnsavedWarning(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}

export default function FormModal({
  dirty, onClose, children,
  title, onSave, saveLabel = 'Save', saveDisabled = false, busy = false, error,
}) {
  const [confirming, setConfirming] = useState(false);
  useUnsavedWarning(dirty);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (confirming) setConfirming(false);
      else if (dirty) setConfirming(true);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, confirming, onClose]);

  // The Save/Cancel pair, rendered at the top and bottom of every form.
  const actions = (
    <div className="toolrow" style={{ justifyContent: 'flex-end' }}>
      <button className="btn ghost" onClick={onClose}>Cancel</button>
      {onSave && (
        <button className="btn primary wide" onClick={onSave} disabled={saveDisabled || busy}>
          {busy ? 'Saving…' : saveLabel}
        </button>
      )}
    </div>
  );

  return (
    <div className="overlay"
         onClick={(e) => e.target === e.currentTarget && (dirty ? setConfirming(true) : onClose())}>
      <div className="card modal">
        <div className="form-head">
          {title && <h2 className="display" style={{ fontSize: 22 }}>{title}</h2>}
          {actions}
        </div>
        {children}
        {error && <p className="error-text" style={{ margin: '10px 0' }}>{error}</p>}
        <div style={{ marginTop: 16 }}>{actions}</div>
      </div>
      {confirming && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setConfirming(false)}>
          <div className="card modal" style={{ maxWidth: 420 }}>
            <h2 className="display" style={{ fontSize: 20, marginBottom: 6 }}>Discard changes?</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 14 }}>
              You have unsaved changes in this form.
            </p>
            <div className="toolrow" style={{ justifyContent: 'flex-end' }}>
              <button className="btn primary" autoFocus onClick={() => setConfirming(false)}>
                Stay on this page
              </button>
              <button className="btn ghost danger" onClick={() => { setConfirming(false); onClose(); }}>
                Discard changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
