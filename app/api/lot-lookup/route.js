import { createClient as createServerClient } from '../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

// Parse a Bidspirit lot URL. The "source" segment varies (catalog/search/…).
function parseLotUrl(link) {
  let m = (link || '').match(/lotPage\/([^/]+)\/source\/[^/]+\/auction\/(\d+)\/lot\/(\d+)/);
  if (!m) m = (link || '').match(/lotPage\/([^/]+)\/(?:[^/]+\/)*?auction\/(\d+)\/lot\/(\d+)/);
  return m ? { house: m[1], auctionId: m[2], lotId: m[3] } : null;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
};

// Admin-only: given a Bidspirit lot link, pull the car details from the same
// catalog CDN API the office bot uses, so the recommend/send form auto-fills.
export async function POST(request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: 'לא מחובר' }, { status: 401 });
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (prof?.role !== 'admin') return Response.json({ ok: false, error: 'למנהלים בלבד' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const link = String(body.url || '').trim();
  const ids = parseLotUrl(link);
  if (!ids) return Response.json({ ok: false, error: 'קישור Bidspirit לא תקין' }, { status: 400 });

  const sub = ((link.match(/\/\/([a-z0-9-]+)\.bidspirit\.com/i) || [])[1]) || 'cars';
  let items;
  try {
    const res = await fetch(
      `https://bidspirit-portal.global.ssl.fastly.net/services/catalogs/getItems?allowEro=true&allowHidden=false&catalogKey=${ids.auctionId}&cdnSubDomain=${sub}&lang=he`,
      { headers: HEADERS, signal: AbortSignal.timeout(15000) },
    );
    items = await res.json();
  } catch {
    return Response.json({ ok: false, error: 'שליפה מ-Bidspirit נכשלה, נסה שוב' }, { status: 502 });
  }

  const it = (Array.isArray(items) ? items : []).find((x) => String(x.idInApp) === String(ids.lotId));
  if (!it) return Response.json({ ok: false, error: 'הרכב לא נמצא במכרז הזה' }, { status: 404 });

  const ci = it.carInfo || {};
  const yearRaw = (ci.modelYearOrYearOnRoad || '').toString().trim() || String(ci.dateOnRoad || '').split('-')[0] || '';
  const year = yearRaw ? (parseInt(String(yearRaw).replace(/[^\d]/g, ''), 10) || '') : '';
  const imgs = (it.imagesList || []).map((n) =>
    `https://bidspirit-images.global.ssl.fastly.net/${it.houseCode || ids.house}/cloned-images/${it.imagesBase}/${String(n).replace(/\.\w+$/, '')}/a_ignore_q_80_w_1000_c_limit_${n}`);
  const listPrice = it.directSalePrice || ci.tariffPrice || '';
  const title = `${ci.manufacturer || ''} ${ci.model || ''}${year ? ' ' + year : ''}`.trim();

  return Response.json({
    ok: true,
    car: {
      title,
      year,
      make: ci.manufacturer || '',
      model: ci.model || '',
      km: ci.mileage || '',
      list_price: listPrice || '',
      license_plate: ci.carNumber || '',
      image_url: imgs[0] || '',
      image_urls: imgs,
      auction_link: link,
    },
  });
}
