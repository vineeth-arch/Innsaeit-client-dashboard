// src/components/FormModal.jsx
// Wraps the overlay+modal pattern for forms. While `dirty`, an accidental
// outside-click or Escape asks before discarding instead of closing silently,
// and reload/tab-close is covered by a native beforeunload prompt. "Stay on
// this page" is the primary, autofocused option, so Enter keeps the form.
import { useEffect, useState } from 'react';

export function useUnsavedWarning(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}

export default function FormModal({ dirty, onClose, children }) {
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

  return (
    <div className="overlay"
         onClick={(e) => e.target === e.currentTarget && (dirty ? setConfirming(true) : onClose())}>
      <div className="card modal">{children}</div>
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
