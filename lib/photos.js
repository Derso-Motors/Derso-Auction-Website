// Real car photos from Wikimedia Commons (free for commercial use).
// Best-effort: returns a base64 data URL of a 1280px photo of the model, or null.

const HE_TO_EN = {
  'פיג\'ו': 'Peugeot', 'פיגו': 'Peugeot', 'טויוטה': 'Toyota', 'קיה': 'Kia', 'יונדאי': 'Hyundai',
  'ניסאן': 'Nissan', 'מאזדה': 'Mazda', 'סקודה': 'Skoda', 'סיאט': 'Seat', 'פולקסווגן': 'Volkswagen',
  'שברולט': 'Chevrolet', 'פורד': 'Ford', 'רנו': 'Renault', 'סיטרואן': 'Citroen', 'דאציה': 'Dacia',
  'דאצ\'יה': 'Dacia', 'מיצובישי': 'Mitsubishi', 'סוזוקי': 'Suzuki', 'סובארו': 'Subaru', 'הונדה': 'Honda',
  'מרצדס': 'Mercedes-Benz', 'ב.מ.וו.': 'BMW', 'ב.מ.וו': 'BMW', 'אאודי': 'Audi', 'וולוו': 'Volvo',
  'לקסוס': 'Lexus', 'צ\'רי': 'Chery', 'קורולה': 'Corolla', 'קשקאי': 'Qashqai', 'ספורטאז': 'Sportage',
  'נירו': 'Niro', 'קודיאק': 'Kodiaq', 'אוקטביה': 'Octavia', 'היילקס': 'Hilux', 'ג\'יפ': 'Jeep',
};

function toEnglishQuery(title) {
  const words = String(title || '').replace(/[0-9,]+/g, ' ').split(/\s+/).filter(Boolean);
  const en = words.map((w) => HE_TO_EN[w] || null).filter(Boolean);
  const year = (String(title).match(/20\d\d/) || [])[0] || '';
  return en.length ? `${en.join(' ')} ${year}`.trim() : null;
}

export async function carPhotoDataUrl(title) {
  try {
    const query = toEnglishQuery(title);
    if (!query) return null;
    const api = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=3&gsrnamespace=6&prop=imageinfo&iiprop=url|mime&iiurlwidth=1280&format=json`;
    const res = await fetch(api, { headers: { 'User-Agent': 'DersoSocialBot/1.0' } });
    const json = await res.json();
    const pages = Object.values(json?.query?.pages || {});
    for (const p of pages) {
      const ii = p.imageinfo?.[0];
      if (!ii?.thumburl || !/jpe?g/i.test(ii.mime || '')) continue;
      const imgRes = await fetch(ii.thumburl, { headers: { 'User-Agent': 'DersoSocialBot/1.0' } });
      if (!imgRes.ok) continue;
      const buf = Buffer.from(await imgRes.arrayBuffer());
      if (buf.length < 20000) continue;
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    }
    return null;
  } catch { return null; }
}
