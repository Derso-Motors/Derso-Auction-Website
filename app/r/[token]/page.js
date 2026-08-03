import { createClient } from '../../../lib/supabase-server';
import InterestButtons from './interest';

export const dynamic = 'force-dynamic';

export default async function RecommendationsPage({ params }) {
  const supabase = createClient();
  const { data: rows } = await supabase.rpc('get_recommendations_by_token', { p_token: params.token });

  if (!rows?.length) {
    return (
      <div className="login-wrap">
        <div className="login-box" style={{ textAlign: 'center' }}>
          <div className="logo">דרסו — בית ליווי מקצועי למכרזים</div>
          <div className="logo-sub">הקישור אינו תקין או שהרשימה הוסרה</div>
        </div>
      </div>
    );
  }

  const listTitle = rows[0].list_title;
  const cars = rows.filter((r) => r.car_id);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, color: 'var(--primary)', textTransform: 'uppercase' }}>דרסו — בית ליווי מקצועי למכרזים</div>
        <div className="page-title">{listTitle}</div>
        <div className="page-sub">רכבים שנבחרו עבורך לפי שיחת האיפיון. סמן לגבי כל רכב אם הוא מעניין אותך.</div>
      </div>

      {cars.map((c) => (
        <div className="card" key={c.car_id}>
          <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{c.title}</div>
              <div className="muted" style={{ marginTop: 4 }}>
                {c.year ? `שנתון ${c.year}` : ''}{c.km ? ` · ${Number(c.km).toLocaleString()} ק"מ` : ''}
              </div>
              {c.notes && <div style={{ marginTop: 8, fontSize: 14 }}>{c.notes}</div>}
              <div style={{ marginTop: 10 }}>
                {c.list_price && <span className="muted">מחירון: ₪{Number(c.list_price).toLocaleString()} · </span>}
                {c.est_price && <span className="price">מחיר משוער: ₪{Number(c.est_price).toLocaleString()}</span>}
              </div>
              {c.auction_date && (
                <div className="muted" style={{ marginTop: 4 }}>
                  מועד מכרז: {new Date(c.auction_date).toLocaleString('he-IL', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              )}
              {c.auction_link && (
                <a href={c.auction_link} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 13.5, display: 'inline-block', marginTop: 8 }}>
                  לצפייה במכרז
                </a>
              )}
            </div>
            {c.image_url && (
              <img src={c.image_url} alt={c.title} style={{ width: 220, maxWidth: '100%', height: 150, objectFit: 'cover', borderRadius: 8 }} />
            )}
          </div>
          <div className="divider" />
          <InterestButtons token={params.token} carId={c.car_id} current={c.client_interest} />
        </div>
      ))}
    </div>
  );
}
