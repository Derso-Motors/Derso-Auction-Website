'use client';
import { useFormStatus } from 'react-dom';
import { useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

export function SubmitButton({ children, className, style, title, disabled }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      style={style}
      title={title}
      type="submit"
      disabled={pending || disabled}
    >
      {pending ? (
        <span className="spinner" aria-label="טוען...">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2a10 10 0 1 0 10 10" />
          </svg>
        </span>
      ) : children}
    </button>
  );
}

export function DeleteButton({ title, confirmText = 'למחוק את הפריט?', confirmSub = 'המחיקה מתבצעת מיד ואינה הפיכה' }) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);

  function confirm() {
    setOpen(false);
    const form = btnRef.current?.closest('form');
    // Remove the surrounding row/card from view immediately; the server
    // action deletes in the DB and revalidates in the background.
    const row = form?.closest('tr') || form?.closest('.inv-card') || form?.closest('.side-item') || form?.closest('li');
    if (row) {
      row.style.transition = 'opacity 0.2s';
      row.style.opacity = '0';
      row.style.pointerEvents = 'none';
      setTimeout(() => { row.style.display = 'none'; }, 200);
    }
    form?.requestSubmit();
  }

  return (
    <>
      <button
        ref={btnRef}
        className="btn-icon-delete"
        type="button"
        title={title}
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        {pending ? '·' : '✕'}
      </button>
      {open && (
        <ConfirmDialog
          title={confirmText}
          sub={confirmSub}
          onConfirm={confirm}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
