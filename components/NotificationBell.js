'use client';
import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase-client';

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('messages')
        .select('id, body, created_at, sender_role')
        .eq('client_id', user.id)
        .eq('read', false)
        .eq('sender_role', 'admin')
        .order('created_at', { ascending: false })
        .limit(10);
      setNotifications(data || []);
      setCount(data?.length || 0);
    }
    load();

    const channel = supabase.channel('notif-bell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.new.sender_role === 'admin') {
          setNotifications(prev => [payload.new, ...prev].slice(0, 10));
          setCount(prev => prev + 1);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="notif-bell"
        onClick={() => setOpen(!open)}
        aria-label="התראות"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && <span className="notif-badge">{count}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-title">התראות</div>
          {!notifications.length && <div className="empty" style={{ padding: '16px' }}>אין התראות חדשות</div>}
          {notifications.map(n => (
            <div key={n.id} className="notif-item">
              <div style={{ fontSize: 13 }}>{n.body}</div>
              <div className="muted" style={{ fontSize: 11 }}>
                {new Date(n.created_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
