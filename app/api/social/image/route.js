import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Branded 1080x1080 post card (dark + gold, SBX style). Query params:
// kind=deal|client_win|weekly_summary|knowledge, title, year, km, list, sold, discount,
// topic, text, bg (optional background image URL, e.g. an AI-generated one).
let fontCache = null;
async function heeboFont() {
  if (fontCache) return fontCache;
  const css = await fetch('https://fonts.googleapis.com/css2?family=Heebo:wght@700&display=swap', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/110.0' },
  }).then((r) => r.text());
  const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
  fontCache = await fetch(url).then((r) => r.arrayBuffer());
  return fontCache;
}

const GOLD = '#d4af37';
const nis = (n) => '₪' + Number(n || 0).toLocaleString('en-US');

export async function GET(req) {
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const font = await heeboFont();
  const kind = q.kind || 'deal';
  const discount = q.discount || (q.list && q.sold ? Math.round((1 - Number(q.sold) / Number(q.list)) * 100) : '');

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: q.bg ? undefined : 'linear-gradient(160deg, #1a1408 0%, #0a0a0a 45%, #000 100%)',
        backgroundImage: q.bg ? `url(${q.bg})` : undefined, backgroundSize: '1080px 1080px',
        color: '#fff', fontFamily: 'Heebo', padding: 64, position: 'relative',
      }}>
        <div style={{ position: 'absolute', inset: 24, border: `2px solid ${GOLD}`, borderRadius: 24, display: 'flex' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 40, color: GOLD, letterSpacing: 4 }}>DERSO</div>
          <div style={{ display: 'flex', fontSize: 26, color: '#bbb' }}>עדכוני מכרזים</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 24 }}>
          {kind === 'weekly_summary' || kind === 'knowledge' ? (
            <>
              <div style={{ display: 'flex', fontSize: 58, color: GOLD, maxWidth: 900 }}>{q.topic || 'סיכום שבועי'}</div>
              <div style={{ display: 'flex', fontSize: 38, color: '#eee', maxWidth: 880, lineHeight: 1.5 }}>{q.text || ''}</div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', fontSize: 30, color: '#bbb' }}>
                {kind === 'client_win' ? '🏆 זכייה של לקוח דרסו' : '🔥 נמכר במכרז'}
              </div>
              <div style={{ display: 'flex', fontSize: 54, maxWidth: 920 }}>{q.title || q.car_title || ''}</div>
              <div style={{ display: 'flex', gap: 30, fontSize: 30, color: '#999' }}>
                {q.year ? <span>שנת {q.year}</span> : null}
                {q.km ? <span>{q.km} ק"מ</span> : null}
              </div>
              {q.list ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                  <span style={{ fontSize: 40, color: '#888', textDecoration: 'line-through' }}>{nis(q.list)}</span>
                  <span style={{ fontSize: 64, color: GOLD }}>{nis(q.sold || q.final_price)}</span>
                </div>
              ) : null}
              {discount ? (
                <div style={{ display: 'flex', background: GOLD, color: '#000', fontSize: 44, padding: '10px 44px', borderRadius: 999 }}>
                  {discount}%- מתחת למחירון
                </div>
              ) : null}
            </>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', fontSize: 28, color: GOLD }}>📡 הצטרפו לשידור — רכבים ישירות לוואטסאפ</div>
          <div style={{ display: 'flex', fontSize: 26, color: '#ccc' }}>auctions.derso.net</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080, fonts: [{ name: 'Heebo', data: font, weight: 700 }] }
  );
}
