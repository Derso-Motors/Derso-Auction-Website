'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '../../../lib/supabase-client';

const PHASES = {
  idle:        { label: 'נדב מוכן',        c1: '#3b82f6', c2: '#22d3ee', speed: '6s' },
  planning:    { label: 'מכין תוכנית…',    c1: '#8b5cf6', c2: '#3b82f6', speed: '3s' },
  dispatching: { label: 'משגר שליחים…',    c1: '#f59e0b', c2: '#ef4444', speed: '1.4s' },
  accepted:    { label: 'שליח שובץ! 🎉',   c1: '#10b981', c2: '#22d3ee', speed: '4s' },
  failed:      { label: 'אף שליח לא אישר', c1: '#ef4444', c2: '#f59e0b', speed: '2s' },
};

export default function NadavLive({ initial }) {
  const [state, setState] = useState(initial || {});
  const [muted, setMuted] = useState(false);
  const lastSpokenTs = useRef(0);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [sending, setSending] = useState(false);
  const recRef = useRef(null);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel('nadav-state')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nadav_state', filter: 'id=eq.current' },
        (payload) => setState(payload.new?.state || {}))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Speak the newest event aloud (ChatGPT-call feel)
  useEffect(() => {
    if (muted || typeof window === 'undefined' || !window.speechSynthesis) return;
    const ev = (state.events || [])[0];
    if (!ev || !ev.ts || ev.ts <= lastSpokenTs.current) return;
    lastSpokenTs.current = ev.ts;
    try {
      const u = new SpeechSynthesisUtterance(ev.text);
      u.lang = 'he-IL'; u.rate = 1.02;
      const vs = window.speechSynthesis.getVoices() || [];
      const he = vs.find((v) => /he[-_]?il/i.test(v.lang)) || vs.find((v) => /^(he|iw)\b/i.test(v.lang)) || vs.find((v) => /hebrew|עברית/i.test(v.name));
      if (he) u.voice = he;
      window.speechSynthesis.speak(u);
    } catch {}
  }, [state.events, muted]);

  // ── Voice input: speak a command → write it to nadav_commands; the office bot
  // polls it, maps it onto the existing owner grammar, and runs it. The reply
  // comes back as an event on nadav_state and is spoken by the effect above.
  const sendCommand = async (text) => {
    const t = (text || '').trim();
    if (!t) return;
    setSending(true);
    try {
      await fetch('/api/nadav/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t }),
      });
    } catch {}
    setSending(false);
  };

  const toggleListen = () => {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('הדפדפן לא תומך בזיהוי דיבור — נסה Chrome'); return; }
    if (listening) { try { recRef.current?.stop(); } catch {} return; }
    const rec = new SR();
    rec.lang = 'he-IL'; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
    rec.onresult = (e) => {
      let txt = '';
      for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setHeard(txt);
      if (e.results[e.results.length - 1].isFinal) sendCommand(txt);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try { window.speechSynthesis?.cancel(); } catch {} // don't record Nadav's own voice
    setHeard(''); setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };

  const phase = PHASES[state.phase] || PHASES.idle;
  const d = state.dispatch;
  const events = state.events || [];
  const couriers = state.couriers || [];

  return (
    <div className="nadav-wrap">
      <style>{`
        .nadav-wrap{min-height:calc(100vh - 60px);color:#e5e7eb}
        .nadav-orb-stage{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 0 10px}
        .nadav-orb{width:190px;height:190px;border-radius:50%;position:relative;
          background:radial-gradient(circle at 35% 30%, var(--o2), var(--o1) 70%);
          box-shadow:0 0 60px 8px color-mix(in srgb, var(--o1) 55%, transparent),
                     inset 0 0 40px color-mix(in srgb, var(--o2) 60%, transparent);
          animation:nadavPulse var(--o-speed) ease-in-out infinite}
        .nadav-orb::after{content:'';position:absolute;inset:-14px;border-radius:50%;
          border:2px solid color-mix(in srgb, var(--o1) 40%, transparent);animation:nadavRing var(--o-speed) ease-out infinite}
        @keyframes nadavPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
        @keyframes nadavRing{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.35);opacity:0}}
        .nadav-headline{margin-top:22px;font-size:22px;font-weight:700;letter-spacing:.5px}
        .nadav-sub{color:#94a3b8;font-size:13px;margin-top:4px}
        .nadav-grid{display:grid;grid-template-columns:1.3fr .9fr;gap:16px;margin-top:22px}
        @media(max-width:820px){.nadav-grid{grid-template-columns:1fr}}
        .nadav-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
          border-radius:16px;padding:16px}
        .nadav-card h3{margin:0 0 12px;font-size:15px;color:#cbd5e1}
        .nadav-route{display:flex;flex-direction:column;gap:8px}
        .nadav-step{display:flex;align-items:center;gap:10px;font-size:14px}
        .nadav-step .ic{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;
          background:rgba(255,255,255,.06);flex-shrink:0}
        .nadav-wf{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}
        .nadav-wf .pill{padding:5px 10px;border-radius:999px;font-size:12px;border:1px solid rgba(255,255,255,.1)}
        .pill.cur{background:#f59e0b22;border-color:#f59e0b;color:#fbbf24}
        .pill.ok{background:#10b98122;border-color:#10b981;color:#34d399}
        .pill.no{opacity:.45;text-decoration:line-through}
        .nadav-feed{display:flex;flex-direction:column;gap:2px;max-height:340px;overflow:auto}
        .nadav-feed .row{display:flex;gap:9px;padding:8px 6px;border-bottom:1px solid rgba(255,255,255,.05);font-size:13.5px}
        .nadav-feed .t{color:#64748b;font-size:11px;white-space:nowrap;margin-inline-start:auto}
        .nadav-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600}
        .nadav-mute{position:fixed;top:70px;inset-inline-end:20px;background:rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.12);color:#e5e7eb;border-radius:10px;padding:7px 12px;cursor:pointer;font-size:13px}

        .nadav-mic{margin-top:18px;width:66px;height:66px;border-radius:50%;border:1px solid rgba(255,255,255,.15);
          background:rgba(255,255,255,.06);color:#e5e7eb;font-size:27px;cursor:pointer;transition:transform .15s}
        .nadav-mic:hover{transform:scale(1.06)}
        .nadav-mic.on{background:#ef444422;border-color:#ef4444;color:#fca5a5;animation:nadavMic 1s ease-in-out infinite}
        @keyframes nadavMic{0%,100%{box-shadow:0 0 0 0 #ef444455}50%{box-shadow:0 0 0 14px #ef444400}}
        .nadav-hint{margin-top:10px;color:#94a3b8;font-size:12.5px;max-width:440px;text-align:center;line-height:1.5}
        .nadav-heard{margin-top:6px;color:#cbd5e1;font-size:14px;font-style:italic}
      `}</style>

      <button className="nadav-mute" onClick={() => setMuted((m) => !m)}>
        {muted ? '🔇 קול כבוי' : '🔊 קול פעיל'}
      </button>

      <div className="nadav-orb-stage">
        <div className="nadav-orb" style={{ '--o1': phase.c1, '--o2': phase.c2, '--o-speed': phase.speed }} />
        <div className="nadav-headline">{state.headline || phase.label}</div>
        <div className="nadav-sub">נדב — מרכז תפעול חי</div>

        <button className={'nadav-mic' + (listening ? ' on' : '')} onClick={toggleListen} title="דבר עם נדב">
          {listening ? '🎙️' : '🎤'}
        </button>
        <div className="nadav-hint">
          {listening ? 'מקשיב… דבר עכשיו' : sending ? 'שולח לנדב…' : 'לחץ ודבר: "פתח משלוח קיה ספורטאז ממגרש אשדוד למוסך ראשלצ" · "מה קורה עם המשלוח" · "אשר"'}
        </div>
        {heard && <div className="nadav-heard">“{heard}”</div>}
      </div>

      <div className="nadav-grid">
        <div className="nadav-card">
          <h3>🚚 משלוח פעיל</h3>
          {!d ? (
            <div style={{ color: '#94a3b8', fontSize: 14 }}>
              אין משלוח פעיל. פתח אחד מטלפון השליטה:<br />
              <code style={{ color: '#cbd5e1' }}>משלוח קיה ספורטאז | מגרש אשדוד | מוסך ראשל"צ</code>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{d.car}</div>
              <div className="nadav-route">
                <div className="nadav-step"><span className="ic">📍</span> איסוף: {d.from}</div>
                <div className="nadav-step"><span className="ic">⛽</span> תדלוק בדרך</div>
                <div className="nadav-step"><span className="ic">🧼</span> שטיפה בדרך</div>
                <div className="nadav-step"><span className="ic">🏁</span> מסירה: {d.to}</div>
              </div>
              {d.notes && <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>📝 {d.notes}</div>}

              <div style={{ marginTop: 14 }}>
                {d.status === 'accepted'
                  ? <span className="nadav-badge" style={{ background: '#10b98122', color: '#34d399' }}>✅ שובץ: {d.acceptedBy?.name}</span>
                  : d.status === 'failed'
                    ? <span className="nadav-badge" style={{ background: '#ef444422', color: '#f87171' }}>⚠️ אף שליח לא אישר</span>
                    : <span className="nadav-badge" style={{ background: '#f59e0b22', color: '#fbbf24' }}>📤 משגר… ({(d.idx ?? 0) + 1}/{d.total})</span>}
              </div>

              {couriers.length > 0 && (
                <div className="nadav-wf">
                  {couriers.map((c, i) => (
                    <span key={i} className={'pill ' + (
                      d.status === 'accepted' && d.acceptedBy?.name === c.name ? 'ok'
                        : d.status === 'dispatching' && i === d.idx ? 'cur'
                          : i < (d.idx ?? 0) ? 'no' : '')}>{c.name}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="nadav-card">
          <h3>⚡ פעילות חיה</h3>
          <div className="nadav-feed">
            {events.length === 0 && <div style={{ color: '#64748b', fontSize: 13, padding: 6 }}>אין אירועים עדיין…</div>}
            {events.map((e, i) => (
              <div key={i} className="row">
                <span>{e.icon || '•'}</span>
                <span>{e.text}</span>
                <span className="t">{e.ts ? new Date(e.ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
