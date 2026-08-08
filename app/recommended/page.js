import Shell from '../../components/Shell';
import { requireUser } from '../../lib/supabase-server';
import RecommendedClient from './RecommendedClient';

export const dynamic = 'force-dynamic';

export default async function RecommendedPage() {
  const { supabase, user } = await requireUser();

  const [{ data: lists }, { data: broadcast }] = await Promise.all([
    supabase.from('recommendation_lists')
      .select('id, title, created_at, recommended_cars(*)')
      .eq('client_id', user.id).order('created_at', { ascending: false }),
    supabase.from('broadcast_cars')
      .select('*').eq('client_id', user.id).order('created_at', { ascending: false }).limit(60),
  ]);

  const cars = (lists || [])
    .flatMap((l) => l.recommended_cars || [])
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const fmt = (n) => (n ? '₪' + Number(n).toLocaleString('he-IL') : null);

  return (
    <Shell active="recommended">
      <h1 className="page-title">רכבים בהמלצה 🚗</h1>
      <p className="page-sub">רכבים שבחרנו במיוחד עבורך — סמן מה מעניין אותך ונתקדם</p>

      {(broadcast || []).length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px' }}>
            📡 שידור <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>— רכבים שהתאמנו לפי מה שאתה מחפש</span>
          </h3>
          <div className="grid cols-3">
            {broadcast.map((c) => (
              <div key={c.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {c.image_url && <img src={c.image_url} alt={c.title} style={{ width: '100%', height: 150, objectFit: 'cover' }} />}
                <div style={{ padding: 12 }}>
                  <div style={{ fontWeight: 700 }}>{c.title}</div>
                  <div className="muted" style={{ fontSize: 12.5, margin: '4px 0' }}>
                    {[c.year, c.km ? `${Number(c.km).toLocaleString('he-IL')} ק"מ` : null].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontSize: 13 }}>
                    {fmt(c.list_price) && <span className="muted" style={{ textDecoration: 'line-through', marginInlineEnd: 6 }}>{fmt(c.list_price)}</span>}
                    {fmt(c.est_price) && <b>{fmt(c.est_price)}</b>}
                  </div>
                  {c.notes && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{c.notes}</div>}
                  {c.auction_link && <a href={c.auction_link} target="_blank" rel="noreferrer" className="btn secondary" style={{ marginTop: 10, display: 'inline-block' }}>לצפייה במכרז ↗</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <RecommendedClient initialCars={cars} />
    </Shell>
  );
}
