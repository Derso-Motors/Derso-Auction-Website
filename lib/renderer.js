// Playwright/Chromium renderer: produces 1080x1080 PNG buffers with proper RTL,
// real car photos, shadows — browser-quality output that satori can't match.
//
// On Vercel serverless: uses @sparticuz/chromium (headless shell).
// Locally / in environments with system Chromium: auto-detects.

import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import { heeboFontData } from './heebo-font.js';

const FONT_FACE = () => {
  const b64 = Buffer.from(heeboFontData()).toString('base64');
  return `@font-face { font-family: 'Heebo'; font-weight: 700; src: url(data:font/ttf;base64,${b64}) format('truetype'); }`;
};

const GOLD = '#d4af37';
const DARK = '#0a0a0a';

// Lazily resolved executable path
let execPath;
async function getExecPath() {
  if (execPath) return execPath;
  // Local/dev override (e.g. system Chromium)
  if (process.env.CHROMIUM_PATH) { execPath = process.env.CHROMIUM_PATH; return execPath; }
  // Vercel / Lambda: download chromium on first cold-start
  execPath = await chromium.executablePath(
    'https://github.com/nicholasgasior/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar'
  );
  return execPath;
}

async function renderHtml(html) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1080, height: 1080 },
    executablePath: await getExecPath(),
    headless: chromium.headless,
  });
  try {
    const page = await browser.newPage();
    // domcontentloaded + settle delay: networkidle0 can hang on font CDNs, and
    // the clip param produced black screenshots on some Chromium builds.
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 1000));
    return await page.screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
}

const nis = (n) => '₪' + Number(n || 0).toLocaleString('he-IL');

// ── Card templates ──

const RED = '#e74c3c';

function baseStyle() {
  return `
    ${FONT_FACE()}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1080px; height: 1080px; overflow: hidden; font-family: 'Heebo', sans-serif;
           direction: rtl; background: ${DARK}; color: #fff; }
    .card { width: 1080px; height: 1080px; position: relative; display: flex;
            flex-direction: column; justify-content: space-between; padding: 60px 56px 0; }
    .bg-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .bg-shade { position: absolute; inset: 0;
                background: linear-gradient(180deg, rgba(5,5,8,0.72) 0%, rgba(5,5,8,0.45) 38%, rgba(5,5,8,0.82) 100%); }
    .header { display: flex; justify-content: space-between; align-items: flex-start;
              position: relative; z-index: 2; }
    .logo { display: flex; flex-direction: column; align-items: flex-start; }
    .logo-main { font-size: 40px; font-weight: 900; color: #fff; letter-spacing: 8px; }
    .logo-sub { font-size: 17px; color: #cfcfcf; letter-spacing: 9px; margin-top: -2px; }
    .page-num { font-size: 24px; color: #bbb; font-weight: 700; }
    .center { flex: 1; display: flex; flex-direction: column; justify-content: center;
              align-items: center; text-align: center; gap: 26px; padding: 10px 0;
              position: relative; z-index: 2; }
    .hook-badge { background: ${RED}; color: #fff; font-size: 26px; font-weight: 800;
                  padding: 10px 34px; border-radius: 12px; display: inline-block;
                  box-shadow: 0 6px 24px rgba(231,60,60,0.45); }
    .hook-box { border: 3px solid rgba(255,255,255,0.92); border-radius: 10px;
                padding: 36px 44px; max-width: 920px;
                background: rgba(5,5,8,0.35); }
    .hook-text { font-size: 56px; font-weight: 900; line-height: 1.45; color: #fff; }
    .hl-red { color: ${RED}; }
    .hl-gold { color: ${GOLD}; }
    .sub-line { font-size: 32px; font-weight: 800; color: #f2f2f2; max-width: 900px; line-height: 1.5; }
    .cta-line { font-size: 28px; font-weight: 700; color: ${GOLD}; }
    .bottom-bar { position: relative; z-index: 2; height: 68px; margin: 0 -56px;
                  display: flex; align-items: center; justify-content: center;
                  background: linear-gradient(90deg, #7a5b12 0%, ${GOLD} 50%, #7a5b12 100%); }
    .bottom-bar span { font-size: 24px; font-weight: 800; color: #0a0a0a; letter-spacing: 1px; }
  `;
}

// Wrap prices in gold and percentages in red — the carousel's highlight language.
function colorize(text) {
  return String(text || '')
    .replace(/(₪[\d,]+|[\d,]+\s?₪)/g, '<span class="hl-gold">$1</span>')
    .replace(/(-?\d+%-?)/g, '<span class="hl-red">$1</span>');
}

function dealHtml(p, photoDataUrl) {
  const discount = p.discount || (p.list && p.sold ? Math.round((1 - Number(p.sold) / Number(p.list)) * 100) : 0);
  const badge = p.kind === 'client_win' ? 'זכייה של לקוח דרסו' : 'עדכוני המכרזים';
  const bgImg = photoDataUrl
    ? `<img class="bg-photo" src="${photoDataUrl}" /><div class="bg-shade"></div>`
    : `<div class="bg-shade" style="background: linear-gradient(160deg, #1a1408 0%, ${DARK} 45%, #000 100%);"></div>`;
  const title = p.title || p.car_title || '';
  const hook = p.list
    ? `${title}<br/>מחירון <span class="hl-red">${nis(p.list)}</span> — נסגר ב<span class="hl-gold">${nis(p.sold || p.final_price)}</span>.`
    : title;
  const sub = [
    p.year ? `שנת ${p.year}` : '',
    p.km ? `${p.km} ק"מ` : '',
    discount ? `<span class="hl-red">${discount}%-</span> מתחת למחירון` : '',
  ].filter(Boolean).join(' · ');
  return `<!DOCTYPE html><html><head><style>${baseStyle()}</style></head><body>
<div class="card">
  ${bgImg}
  <div class="header">
    <div class="logo"><div class="logo-main">DERSO</div><div class="logo-sub">רכבים</div></div>
  </div>
  <div class="center">
    <div class="hook-badge">${badge}</div>
    <div class="hook-box"><div class="hook-text">${hook}</div></div>
    ${sub ? `<div class="sub-line">${sub}</div>` : ''}
    <div class="cta-line">← הצטרפו לשידור — auctions.derso.net</div>
  </div>
  <div class="bottom-bar"><span>שירות מציאת רכבים · רכבים ישירות לוואטסאפ</span></div>
</div>
</body></html>`;
}

function topicHtml(p) {
  const AREAS = { cost_of_living: 'יוקר המחיה', road_safety: 'בטיחות בדרכים', car_economy: 'כלכלת הרכב', driving_world: 'עולם הנהיגה', auctions: 'עדכוני המכרזים' };
  const areaLabel = AREAS[p.area] || p.area_label || 'נושא חם';
  return `<!DOCTYPE html><html><head><style>${baseStyle()}</style></head><body>
<div class="card">
  <div class="bg-shade" style="background: linear-gradient(160deg, #1a1408 0%, ${DARK} 45%, #000 100%);"></div>
  <div class="header">
    <div class="logo"><div class="logo-main">DERSO</div><div class="logo-sub">רכבים</div></div>
  </div>
  <div class="center">
    <div class="hook-badge">${areaLabel}</div>
    <div class="hook-box"><div class="hook-text" style="font-size:50px;">${colorize(p.topic || p.title || '')}</div></div>
    <div class="sub-line">${colorize(p.text || p.facts || p.pain_point || '')}</div>
    <div class="cta-line">← הצטרפו לשידור — auctions.derso.net</div>
  </div>
  <div class="bottom-bar"><span>שירות מציאת רכבים · רכבים ישירות לוואטסאפ</span></div>
</div>
</body></html>`;
}

// ── Public API ──

/**
 * Render a branded 1080×1080 post image with real Chrome.
 * Returns a PNG Buffer.
 * @param {string} kind - deal | client_win | topic | weekly_summary | knowledge | news
 * @param {object} payload - post payload
 * @param {string|null} photoDataUrl - optional base64 data URL of a car photo
 */
export async function renderPostImage(kind, payload, photoDataUrl = null) {
  const p = { ...payload, kind };
  let html;
  if (['topic', 'news', 'weekly_summary', 'knowledge'].includes(kind)) {
    html = topicHtml(p);
  } else {
    html = dealHtml(p, photoDataUrl);
  }
  return renderHtml(html);
}
