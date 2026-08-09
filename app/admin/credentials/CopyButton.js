'use client';
import { useState } from 'react';

export default function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* fallback: user can select text */ }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`העתק ${label}`}
      style={{
        marginInlineStart: 6, background: 'none', border: '1px solid var(--border)',
        borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 12,
        color: copied ? 'var(--green)' : 'var(--fg2)',
      }}
    >
      {copied ? '✓' : '📋'}
    </button>
  );
}
