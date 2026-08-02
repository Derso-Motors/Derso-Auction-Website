'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '../../lib/supabase-client';

export default function Chat({ clientId, initialMessages, senderRole = 'client' }) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages-${clientId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` }, (payload) => {
        setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('messages')
      .insert({ client_id: clientId, sender_role: senderRole, body: body.trim() })
      .select()
      .single();
    if (data) setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    setBody('');
    setSending(false);
  }

  return (
    <div>
      <div style={{ maxHeight: 420, overflowY: 'auto', marginBottom: 16 }}>
        {!messages.length && <div className="empty">אין הודעות עדיין — אפשר לכתוב לנו כאן</div>}
        {messages.map((m) => (
          <div key={m.id} className={`msg-row ${m.sender_role}`}>
            <div>
              <div className="msg-bubble">{m.body}</div>
              <div className="msg-time" style={{ textAlign: m.sender_role === 'client' ? 'right' : 'left' }}>
                {new Date(m.created_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="row">
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="כתיבת הודעה..." />
        <button className="btn" disabled={sending || !body.trim()} style={{ whiteSpace: 'nowrap' }}>שליחה</button>
      </form>
    </div>
  );
}
