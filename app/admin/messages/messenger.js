'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '../../../lib/supabase-client';

export default function Messenger({ conversations: initial }) {
  const [conversations, setConversations] = useState(initial);
  const [activeId, setActiveId] = useState(initial[0]?.id || null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const bottomRef = useRef(null);

  const active = conversations.find((c) => c.id === activeId);
  const messages = active?.messages || [];

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new;
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== msg.client_id) return c;
            const exists = c.messages.some((m) => m.id === msg.id);
            return {
              ...c,
              messages: exists ? c.messages : [...c.messages, msg],
              lastMessage: msg.body,
              lastAt: msg.created_at,
              unreadCount: msg.sender_role === 'client' ? c.unreadCount + 1 : c.unreadCount,
            };
          })
        );
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeId, messages.length]);

  useEffect(() => {
    if (!active || active.unreadCount === 0) return;
    const supabase = createClient();
    supabase.from('messages').update({ read: true })
      .eq('client_id', activeId).eq('sender_role', 'client').eq('read', false)
      .then(() => {
        setConversations((prev) =>
          prev.map((c) => c.id === activeId ? { ...c, unreadCount: 0 } : c)
        );
      });
  }, [activeId]);

  async function send(e) {
    e.preventDefault();
    if (!body.trim() || !activeId) return;
    setSending(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('messages')
      .insert({ client_id: activeId, sender_role: 'admin', body: body.trim() })
      .select()
      .single();
    if (data) {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeId) return c;
          const exists = c.messages.some((m) => m.id === data.id);
          return {
            ...c,
            messages: exists ? c.messages : [...c.messages, data],
            lastMessage: data.body,
            lastAt: data.created_at,
          };
        })
      );
    }
    setBody('');
    setSending(false);
  }

  const filtered = search
    ? conversations.filter((c) =>
        (c.full_name || '').includes(search) || (c.phone || '').includes(search)
      )
    : conversations;

  return (
    <div className="messenger">
      <div className="messenger-sidebar">
        <div className="messenger-search">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לקוח..."
          />
        </div>
        <div className="messenger-list">
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`messenger-item ${c.id === activeId ? 'active' : ''} ${c.unreadCount > 0 ? 'unread' : ''}`}
              onClick={() => setActiveId(c.id)}
            >
              <div className="messenger-avatar">
                {(c.full_name || '?')[0]}
              </div>
              <div className="messenger-info">
                <div className="messenger-name">
                  {c.full_name || 'ללא שם'}
                  {c.unreadCount > 0 && (
                    <span className="messenger-badge">{c.unreadCount}</span>
                  )}
                </div>
                <div className="messenger-preview">
                  {c.lastMessage
                    ? c.lastMessage.length > 40
                      ? c.lastMessage.slice(0, 40) + '...'
                      : c.lastMessage
                    : 'אין הודעות'}
                </div>
              </div>
              {c.lastAt && (
                <div className="messenger-time">
                  {new Date(c.lastAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          ))}
          {!filtered.length && <div className="empty">אין לקוחות</div>}
        </div>
      </div>

      <div className="messenger-chat">
        {active ? (
          <>
            <div className="messenger-header">
              <div className="messenger-avatar">{(active.full_name || '?')[0]}</div>
              <div>
                <div style={{ fontWeight: 600 }}>{active.full_name || 'לקוח'}</div>
                <div className="muted" style={{ fontSize: 12 }}>{active.phone || ''}</div>
              </div>
            </div>
            <div className="messenger-messages">
              {!messages.length && <div className="empty">אין הודעות עדיין — שלח הודעה ראשונה</div>}
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
            <form onSubmit={send} className="messenger-input">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="כתיבת הודעה..."
              />
              <button className="btn" disabled={sending || !body.trim()}>שליחה</button>
            </form>
          </>
        ) : (
          <div className="messenger-empty">
            <div className="empty">בחר לקוח מהרשימה כדי להתחיל שיחה</div>
          </div>
        )}
      </div>
    </div>
  );
}
