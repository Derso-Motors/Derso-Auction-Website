'use client';

import { useEffect, useState } from 'react';

// Global action feedback: server actions redirect back with ?ok=... or ?err=...
// and this component (mounted once in Shell) pops the message and cleans the URL.
// Toast text should be plain — strip emojis/symbols that come with the message.
function clean(text) {
  return String(text || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
}

export default function PageToast() {
  const [toast, setToast] = useState(null); // { kind: 'ok'|'err', text }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ok = params.get('ok');
    const err = params.get('err');
    if (!ok && !err) return;
    setToast({ kind: err ? 'err' : 'ok', text: err || ok });
    params.delete('ok'); params.delete('err');
    const rest = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!toast) return null;
  return (
    <div className={`inv-toast ${toast.kind === 'err' ? 'toast-err' : ''}`} onClick={() => setToast(null)}>
      {clean(toast.text)}
    </div>
  );
}
