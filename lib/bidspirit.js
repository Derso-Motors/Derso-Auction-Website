// BidSpirit lot lookup — shared by the lot-lookup API and server actions.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
};

export function parseLotUrl(link) {
  let m = (link || '').match(/lotPage\/([^/]+)\/source\/[^/]+\/auction\/(\d+)\/lot\/(\d+)/);
  if (!m) m = (link || '').match(/lotPage\/([^/]+)\/(?:[^/]+\/)*?auction\/(\d+)\/lot\/(\d+)/);
  return m ? { house: m[1], auctionId: m[2], lotId: m[3] } : null;
}

export async function lookupLot(link) {
  const ids = parseLotUrl(link);
  if (!ids) return { ok: false, error: 'קישור Bidspirit לא תקין' };
  const sub = ((link.match(/\/\/([a-z0-9-]+)\.bidspirit\.com/i) || [])[1]) || 'cars';
  let items;
  try {
    const res = await fetch(
      `https://bidspirit-portal.global.ssl.fastly.net/services/catalogs/getItems?allowEro=true&allowHidden=false&catalogKey=${ids.auctionId}&cdnSubDomain=${sub}&lang=he`,
      { headers: HEADERS, signal: AbortSignal.timeout(15000) },
    );
    items = await res.json();
  } catch {
    return { ok: false, error: 'שליפה מ-Bidspirit נכשלה, נסה שוב' };
  }
  const it = (Array.isArray(items) ? items : []).find((x) => String(x.idInApp) === String(ids.lotId));
  if (!it) return { ok: false, error: 'הרכב לא נמצא במכרז הזה' };
  const ci = it.carInfo || {};
  const yearRaw = (ci.modelYearOrYearOnRoad || '').toString().trim() || String(ci.dateOnRoad || '').split('-')[0] || '';
  const year = yearRaw ? (parseInt(String(yearRaw).replace(/[^\d]/g, ''), 10) || '') : '';
  const imgs = (it.imagesList || []).map((n) =>
    `https://bidspirit-images.global.ssl.fastly.net/${it.houseCode || ids.house}/cloned-images/${it.imagesBase}/${String(n).replace(/\.\w+$/, '')}/a_ignore_q_80_w_1000_c_limit_${n}`);
  const listPrice = it.directSalePrice || ci.tariffPrice || '';
  const title = `${ci.manufacturer || ''} ${ci.model || ''}${year ? ' ' + year : ''}`.trim();

  // Auction date: the auction-house subdomain lists its auction days with startDate.
  let auctionDate = null;
  try {
    const house = it.houseCode || ids.house;
    for (const when of ['PAST', 'FUTURE']) {
      const dr = await fetch(
        `https://${house}.bidspirit.com/api/auctions/list/getNonHiddenAuctionDays.api?time=${when}&limit=200&offset=0&localId=Bidder_derso&_=1`,
        { headers: HEADERS, signal: AbortSignal.timeout(10000) },
      );
      const dj = await dr.json().catch(() => ({}));
      const day = (dj.response || []).find((d) => String(d.auctionId) === String(it.auctionIdInApp));
      if (day?.startDate) { auctionDate = day.startDate; break; }
    }
  } catch {}
  return {
    ok: true,
    car: {
      title, year,
      make: ci.manufacturer || '',
      model: ci.model || '',
      km: ci.mileage || '',
      list_price: listPrice || '',
      license_plate: ci.carNumber || '',
      image_url: imgs[0] || '',
      image_urls: imgs,
      auction_link: link,
      auction_date: auctionDate,
    },
  };
}
