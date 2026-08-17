// Real car photos from Wikimedia Commons (free for commercial use).
// Strategy: find the car's CATEGORY (e.g. "Category:Ford Bronco (6th generation)")
// and pick a full-car photo from it — plain filename search returns horses,
// vans and wheel close-ups.

const UA = { 'User-Agent': 'DersoSocialBot/1.0' };

const HE_TO_EN = {
  'פיג\'ו': 'Peugeot', 'פיגו': 'Peugeot', 'טויוטה': 'Toyota', 'קיה': 'Kia', 'יונדאי': 'Hyundai',
  'ניסאן': 'Nissan', 'מאזדה': 'Mazda', 'סקודה': 'Skoda', 'סיאט': 'Seat', 'פולקסווגן': 'Volkswagen',
  'שברולט': 'Chevrolet', 'פורד': 'Ford', 'רנו': 'Renault', 'סיטרואן': 'Citroen', 'דאציה': 'Dacia',
  'דאצ\'יה': 'Dacia', 'מיצובישי': 'Mitsubishi', 'סוזוקי': 'Suzuki', 'סובארו': 'Subaru', 'הונדה': 'Honda',
  'מרצדס': 'Mercedes-Benz', 'ב.מ.וו.': 'BMW', 'ב.מ.וו': 'BMW', 'אאודי': 'Audi', 'וולוו': 'Volvo',
  'לקסוס': 'Lexus', 'צ\'רי': 'Chery', 'קורולה': 'Corolla', 'קשקאי': 'Qashqai', 'ספורטאז': 'Sportage',
  'נירו': 'Niro', 'קודיאק': 'Kodiaq', 'אוקטביה': 'Octavia', 'היילקס': 'Hilux', 'ג\'יפ': 'Jeep',
  'ברונקו': 'Bronco', 'טוסון': 'Tucson', 'סיד': 'Ceed', 'פיקנטו': 'Picanto', 'ריו': 'Rio',
  'יאריס': 'Yaris', 'קאמרי': 'Camry', 'ראב 4': 'RAV4', 'ראב4': 'RAV4', 'סנטה פה': 'Santa Fe',
};

function toEnglishQuery(title) {
  const words = String(title || '').replace(/[0-9,]+/g, ' ').split(/\s+/).filter(Boolean);
  const en = words.map((w) => HE_TO_EN[w] || null).filter(Boolean);
  return en.length ? en.join(' ') : null;
}

const DETAIL = /wheel|interior|engine|dashboard|seat|badge|logo|detail|door|trunk|boot|dash|steering|gauge|screen|key/i;

function frontScore(t) { return /front/i.test(t || '') ? 10 : 0; }
function yearScore(fileTitle, want) {
  const got = Number((String(fileTitle).match(/20\d\d/) || [])[0]) || 0;
  return got ? -Math.abs(want - got) : -6;
}

async function api(params) {
  const url = 'https://commons.wikimedia.org/w/api.php?format=json&action=query&' + params;
  const res = await fetch(url, { headers: UA });
  return res.json();
}

export async function carPhotoDataUrl(title) {
  try {
    const query = toEnglishQuery(title);
    if (!query) return null;
    const wantYear = Number((String(title).match(/20\d\d/) || [])[0]) || 2020;

    // 1. Find the model's category
    const catRes = await api(`list=search&srsearch=${encodeURIComponent(query)}&srnamespace=14&srlimit=8`);
    const cats = (catRes?.query?.search || []).map((s) => s.title)
      .filter((t) => query.split(' ').every((w) => t.toLowerCase().includes(w.toLowerCase())));
    if (!cats.length) return null;
    // Recent model years → prefer a generation-specific category (higher generation number)
    const genNum = (t) => Number((t.match(/(\d+)(?:st|nd|rd|th) generation/) || [])[1]) || 0;
    cats.sort((a, b) => genNum(b) - genNum(a));
    const cat = wantYear >= 2018 && cats.some((c) => genNum(c) > 0) ? cats.find((c) => genNum(c) > 0) : cats[0];

    // 2. List files in the category, pick the best full-car shot
    const filesRes = await api(`list=categorymembers&cmtitle=${encodeURIComponent(cat)}&cmtype=file&cmlimit=40`);
    const files = (filesRes?.query?.categorymembers || [])
      .map((m) => m.title)
      .filter((t) => /\.jpe?g$/i.test(t) && !DETAIL.test(t))
      .sort((a, b) => (frontScore(b) + yearScore(b, wantYear)) - (frontScore(a) + yearScore(a, wantYear)));

    // 3. Download the first good one at 1280px
    for (const file of files.slice(0, 5)) {
      const infoRes = await api(`titles=${encodeURIComponent(file)}&prop=imageinfo&iiprop=url|mime&iiurlwidth=1280`);
      const page = Object.values(infoRes?.query?.pages || {})[0];
      const ii = page?.imageinfo?.[0];
      if (!ii?.thumburl) continue;
      const imgRes = await fetch(ii.thumburl, { headers: UA });
      if (!imgRes.ok) continue;
      const buf = Buffer.from(await imgRes.arrayBuffer());
      if (buf.length < 30000) continue; // too small = likely broken/placeholder
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    }
    return null;
  } catch { return null; }
}
