'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const PLATFORM = {
  instagram: { label: 'Instagram', color: '#f0508a' },
  tiktok: { label: 'TikTok', color: '#25d9d2' },
  facebook: { label: 'Facebook', color: '#5b9dff' },
  youtube: { label: 'YouTube', color: '#ff5a5a' },
  linkedin: { label: 'LinkedIn', color: '#4f9ce0' },
  x: { label: 'X', color: '#d4d4d8' },
  threads: { label: 'Threads', color: '#c4b5fd' },
  bluesky: { label: 'Bluesky', color: '#60a5fa' },
  pinterest: { label: 'Pinterest', color: '#f87171' },
};
const plat = (p) => PLATFORM[p] || { label: p, color: 'var(--muted)' };

const STATUS = { ok: ['מחובר', 'ok'], bad: ['החיבור נותק', 'bad'], unknown: ['לא ידוע', 'unknown'] };

const METRIC_LABELS = {
  followers: 'עוקבים', views: 'צפיות', impressions: 'חשיפות', reach: 'חשבונות שנחשפו', likes: 'לייקים',
  comments: 'תגובות', shares: 'שיתופים', saves: 'שמירות', engagement: 'מעורבות', engagementRate: 'אחוז מעורבות',
  engagement_rate: 'אחוז מעורבות', posts: 'פוסטים', clicks: 'קליקים', profileViews: 'כניסות לפרופיל',
};

const fmt = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n ?? '—');
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e4) return (v / 1e3).toFixed(1) + 'K';
  return v.toLocaleString('he-IL', { maximumFractionDigits: 2 });
};

const AVATAR_COLORS = ['#5b5bd6', '#b45309', '#be185d', '#047857', '#b91c1c', '#0369a1', '#4d7c0f', '#7c3aed', '#a16207', '#334155'];
const avatarColor = (s) => AVATAR_COLORS[[...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_COLORS.length];

function Avatar({ acc, size = 32 }) {
  const style = { width: size, height: size, fontSize: size * 0.44 };
  if (acc.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="hub-ava" src={acc.avatar} alt="" style={style} />;
  }
  return <span className="hub-ava" style={{ ...style, background: avatarColor(acc.name) }}>{String(acc.name).replace('@', '').charAt(0)}</span>;
}

const PlatformChip = ({ p }) => <span className="hub-plat" style={{ color: plat(p).color }}>{plat(p).label}</span>;
const StatusDot = ({ s }) => <span className={`hub-status ${STATUS[s][1]}`}>{STATUS[s][0]}</span>;

// Split analytics into headline numbers and their period-over-period changes.
function metricsOf(stats) {
  if (!stats) return [];
  const flat = [];
  const walk = (o, prefix) => {
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, prefix ? `${prefix}.${k}` : k);
      else if (typeof v === 'number') flat.push([prefix ? `${prefix}.${k}` : k, v]);
    }
  };
  walk(stats, '');
  const isChange = (k) => /change|delta|growth|diff|pct|percent/i.test(k);
  const values = flat.filter(([k]) => !isChange(k));
  return values.map(([k, v]) => {
    const base = k.split('.').pop();
    const change = flat.find(([ck]) => isChange(ck) && ck.toLowerCase().includes(base.toLowerCase()));
    return { key: k, label: METRIC_LABELS[base] || base, value: v, change: change?.[1] };
  });
}

function Modal({ acc, onClose }) {
  const [tab, setTab] = useState('overview');
  const closeRef = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  const metrics = metricsOf(acc.stats);
  const tabs = [['overview', 'סקירה'], ['posts', 'פוסטים מובילים'], ['details', 'פרטי חיבור']];

  return (
    <div className="hub-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="hub-modal" role="dialog" aria-modal="true" aria-labelledby="hub-modal-title">
        <div className="hub-m-head">
          <Avatar acc={acc} size={46} />
          <div style={{ minWidth: 0 }}>
            <h2 id="hub-modal-title">{acc.name}</h2>
            <div className="hub-row">
              <PlatformChip p={acc.platform} />
              {acc.handle && <span className="hub-mono hub-muted">{acc.handle}</span>}
              <StatusDot s={acc.status} />
            </div>
          </div>
          <button ref={closeRef} className="hub-close" onClick={onClose} aria-label="סגירה">✕</button>
        </div>

        <div className="hub-tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        <div className="hub-m-body">
          {tab === 'overview' && (
            <>
              {acc.status === 'bad' && (
                <div className="hub-callout bad">
                  החיבור של החשבון הזה ל-Socialync נותק{acc.statusText ? ` (${acc.statusText})` : ''}. צריך לחבר אותו מחדש באפליקציה של Socialync, אחרת פוסטים אליו ייכשלו.
                </div>
              )}
              {metrics.length ? (
                <>
                  <div className="hub-metrics">
                    {metrics.map((m) => (
                      <div key={m.key} className="hub-metric">
                        <b>{fmt(m.value)}</b>
                        <span>{m.label}</span>
                        {m.change != null && (
                          <span className={`hub-delta ${m.change >= 0 ? 'up' : 'down'}`}>{m.change >= 0 ? '▲' : '▼'} {fmt(Math.abs(m.change))}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="hub-muted hub-small">
                    נתוני 30 הימים האחרונים כפי ש-Socialync מחזיר אותם לכל {plat(acc.platform).label} ב{acc.profileName ? `מותג "${acc.profileName}"` : 'חשבון'}.
                  </p>
                </>
              ) : (
                <div className="hub-callout">Socialync לא החזיר אנליטיקס לחשבון הזה. בתחתית הדף אפשר לראות את התשובה הגולמית.</div>
              )}
              <p className="hub-muted hub-small">Retention ונתוני קהל לא זמינים ב-API של Socialync.</p>
            </>
          )}

          {tab === 'posts' && (
            acc.topPosts?.length ? (
              <div className="hub-posts">
                {acc.topPosts.map((p, i) => (
                  <div key={i} className="hub-post">
                    <div style={{ minWidth: 0 }}>
                      <div className="hub-post-text">{p.text || 'ללא כיתוב'}</div>
                      <div className="hub-muted hub-small hub-mono">
                        {p.date ? new Date(p.date).toLocaleDateString('he-IL') : ''}
                        {p.verdict ? ` · ${p.verdict}` : ''}
                        {p.url && <> · <a href={p.url} target="_blank" rel="noreferrer">לפוסט</a></>}
                      </div>
                    </div>
                    <div className="hub-post-nums hub-mono">
                      {p.views != null && <span><b>{fmt(p.views)}</b> צפיות</span>}
                      {p.likes != null && <span><b>{fmt(p.likes)}</b> לייקים</span>}
                      {p.engagement != null && <span><b>{fmt(p.engagement)}</b> מעורבות</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="hub-callout">אין פוסטים מובילים לחשבון הזה ב-Socialync.</div>
          )}

          {tab === 'details' && <pre className="hub-pre">{JSON.stringify(acc.raw, null, 2)}</pre>}
        </div>
      </div>
    </div>
  );
}

export default function AccountsHub({ accounts }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [openKey, setOpenKey] = useState(null);

  const platforms = useMemo(() => [...new Set(accounts.map((a) => a.platform))], [accounts]);
  const counts = (f) => accounts.filter((a) => f === 'all' || a.platform === f || a.status === f).length;
  const visible = accounts.filter((a) =>
    (filter === 'all' || a.platform === filter || a.status === filter) &&
    (!q || `${a.name} ${a.handle || ''} ${a.profileName || ''}`.toLowerCase().includes(q.toLowerCase())));
  const open = accounts.find((a) => a.key === openKey);
  const broken = accounts.filter((a) => a.status === 'bad').length;
  const followers = accounts.reduce((s, a) => s + (a.followers || 0), 0);

  return (
    <>
      <div className="hub-kpis">
        <div className="hub-kpi"><b>{accounts.length}</b><span>חשבונות מחוברים</span></div>
        <div className="hub-kpi"><b>{platforms.length}</b><span>פלטפורמות</span></div>
        <div className="hub-kpi"><b>{followers ? fmt(followers) : '—'}</b><span>עוקבים בסך הכל</span></div>
        <div className="hub-kpi"><b style={{ color: broken ? 'var(--danger)' : undefined }}>{broken}</b><span>חיבורים שנותקו</span></div>
      </div>

      <div className="hub-toolbar">
        {[['all', 'הכל'], ...platforms.map((p) => [p, plat(p).label]), ...(broken ? [['bad', 'נותקו']] : [])].map(([f, label]) => (
          <button key={f} className="hub-chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {label} <span className="hub-mono">{counts(f)}</span>
          </button>
        ))}
        <input className="hub-search" type="search" placeholder="חיפוש לפי שם או @" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="hub-table-wrap">
        {visible.length ? (
          <table className="hub-table">
            <thead>
              <tr><th>חשבון</th><th>פלטפורמה</th><th>מותג ב-Socialync</th><th>עוקבים</th><th>סטטוס</th></tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.key} onClick={() => setOpenKey(a.key)}>
                  <td>
                    <div className="hub-acc">
                      <Avatar acc={a} />
                      <div style={{ minWidth: 0 }}>
                        <button className="hub-acc-name" onClick={(e) => { e.stopPropagation(); setOpenKey(a.key); }}>{a.name}</button>
                        {a.handle && <div className="hub-mono hub-muted hub-small">{a.handle}</div>}
                      </div>
                    </div>
                  </td>
                  <td><PlatformChip p={a.platform} /></td>
                  <td className="hub-muted">{a.profileName || '—'}</td>
                  <td className="hub-mono">{a.followers ? fmt(a.followers) : '—'}</td>
                  <td><StatusDot s={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="hub-muted" style={{ padding: 16, margin: 0 }}>
            {accounts.length ? 'אין חשבונות שמתאימים לחיפוש.' : 'Socialync לא החזיר חשבונות מחוברים. אפשר לבדוק את התשובה הגולמית בתחתית הדף.'}
          </p>
        )}
      </div>

      {open && <Modal acc={open} onClose={() => setOpenKey(null)} />}
    </>
  );
}
