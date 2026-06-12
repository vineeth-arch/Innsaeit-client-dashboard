// src/components/ConfirmDialog.jsx
// Shared confirmation for destructive actions (file, comment, checklist item,
// SKU). Reuses the overlay/modal shell; confirm carries the danger style and
// a busy state. Outside-click cancels — there's nothing typed to lose here.
export default function ConfirmDialog({
  title, message, confirmLabel = 'Delete', busyLabel = 'Deleting…',
  busy, error, onCancel, onConfirm,
}) {
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="card modal" style={{ maxWidth: 460 }}>
        <h2 className="display" style={{ fontSize: 22, marginBottom: 6 }}>{title}</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 14 }}>{message}</p>
        {error && <p className="error-text" style={{ marginBottom: 10 }}>{error}</p>}
        <div className="toolrow" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn danger" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
