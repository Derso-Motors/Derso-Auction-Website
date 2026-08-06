'use client';

import { useEffect, useRef, useState } from 'react';

const HELLO_ADMIN = { role: 'bot', text: 'היי! 👋 אני העוזר האישי שלך.\nכתוב לי משפט אחד ואני אדאג לשאר, למשל:\n• "פגישה עם דני מחר ב-16:00"\n• "תזכיר לי להתקשר לראול ב-18:00"\n• "רשום שהחייב רוצה לפדות"\n• "מה יש לי היום?"' };
const HELLO_CLIENT = { role: 'bot', text: 'היי! 👋 אני העוזר של דרסו.\nאני כאן לשאלות על החשבון שלך:\n• "מה הסטטוס של הרכב שלי?"\n• "מתי הפגישה הבאה שלי?"\n• "כמה עולה בדיקת רכב?"\n• "כמה קרדיטים יש לי?"' };

export default function AssistantWidget({ isAdmin = false }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([isAdmin ? HELLO_ADMIN : HELLO_CLIENT]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    // Prior turns (before this message) become the conversation history sent
    // to the server, so the assistant can hold a multi-turn conversation.
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'bot')
      .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))
      .slice(-10);
    setMessages((m) => [...m, { role: 'user', text }]);
    setBusy(true);
    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      const j = await res.json().catch(() => null);
      setMessages((m) => [...m, { role: 'bot', text: j?.reply || 'משהו השתבש, נסה שוב 😕' }]);
    } catch {
      setMessages((m) => [...m, { role: 'bot', text: 'אין חיבור כרגע, נסה שוב 😕' }]);
    }
    setBusy(false);
  }

  return (
    <>
      {open && (
        <div className="assistant-panel">
          <div className="assistant-header">
            <span>🤖 העוזר האישי</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="סגירה">✕</button>
          </div>
          <div className="assistant-body">
            {messages.map((m, i) => (
              <div key={i} className={`assistant-msg ${m.role}`}>
                {m.text.split('\n').map((line, j) => <div key={j}>{line.replace(/\*/g, '')}</div>)}
              </div>
            ))}
            {busy && <div className="assistant-msg bot typing">...</div>}
            <div ref={bottomRef} />
          </div>
          <form className="assistant-input" onSubmit={send}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="כתוב הודעה..."
              disabled={busy}
            />
            <button className="btn" type="submit" disabled={busy || !input.trim()}>שלח</button>
          </form>
        </div>
      )}
      <button className={`assistant-bubble ${open ? 'open' : ''}`} type="button" onClick={() => setOpen(!open)}>
        <span className="assistant-bubble-icon">{open ? '✕' : '🤖'}</span>
        {!open && <span className="assistant-bubble-label">העוזר האישי</span>}
      </button>
    </>
  );
}
