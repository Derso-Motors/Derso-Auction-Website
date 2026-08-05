'use client';

// Shared styled confirmation dialog — replaces the browser's native confirm().
export default function ConfirmDialog({ icon = '🗑️', title, sub, confirmLabel = 'כן, מחיקה', danger = true, busy = false, onConfirm, onClose }) {
  return (
    <div className="confirm-overlay" onClick={() => !busy && onClose()}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon">{icon}</div>
        <div className="confirm-title">{title}</div>
        {sub && <div className="confirm-sub">{sub}</div>}
        <div className="confirm-actions">
          <button className={`btn ${danger ? 'danger' : ''}`} type="button" disabled={busy} onClick={onConfirm}>
            {busy ? '...' : confirmLabel}
          </button>
          <button className="btn secondary" type="button" disabled={busy} onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
