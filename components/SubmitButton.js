'use client';
import { useFormStatus } from 'react-dom';

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
      {pending ? '...' : children}
    </button>
  );
}

export function DeleteButton({ title }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="btn-icon-delete"
      type="submit"
      title={title}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm('בטוח למחוק?')) e.preventDefault();
      }}
    >
      {pending ? '·' : '✕'}
    </button>
  );
}
