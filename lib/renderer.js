// Playwright/Chromium renderer: produces 1080x1080 PNG buffers with proper RTL,
// real car photos, shadows — browser-quality output that satori can't match.
//
// On Vercel serverless: uses @sparticuz/chromium (headless shell).
// Locally / in environments with system Chromium: auto-detects.

import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import { heeboFontData } from './heebo-font';

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

function baseStyle() {
  return `
    ${FONT_FACE()}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1080px; height: 1080px; overflow: hidden; font-family: 'Heebo', sans-serif;
           direction: rtl; background: ${DARK}; color: #fff; }
    .card { width: 1080px; height: 1080px; position: relative; display: flex;
            flex-direction: column; justify-content: space-between; padding: 56px; }
    .border { position: absolute; inset: 20px; border: 2px solid ${GOLD}; border-radius: 20px; pointer-events: none; }
    .logo { display: flex; flex-direction: column; align-items: flex-start; }
    .logo-main { font-size: 44px; font-weight: 900; color: ${GOLD}; letter-spacing: 6px; }
    .logo-sub { font-size: 18px; color: #aaa; letter-spacing: 10px; margin-top: -4px; }
    .header { display: flex; justify-content: space-between; align-items: center; }
    .header-label { font-size: 22px; color: #999; }
    .center { flex: 1; display: flex; flex-direction: column; justify-content: center;
              align-items: center; text-align: center; gap: 20px; padding: 20px 0; }
    .title { font-size: 52px; font-weight: 900; line-height: 1.3; max-width: 900px;
             text-shadow: 0 4px 24px rgba(0,0,0,0.7); }
    .meta { font-size: 28px; color: #999; display: flex; gap: 32px; justify-content: center; }
    .prices { display: flex; align-items: center; gap: 24px; justify-content: center; }
    .list-price { font-size: 38px; color: #777; text-decoration: line-through; }
    .sold-price { font-size: 62px; font-weight: 900; color: ${GOLD};
                  text-shadow: 0 0 30px rgba(212,175,55,0.4); }
    .badge { background: ${GOLD}; color: #000; font-size: 40px; font-weight: 900;
             padding: 8px 40px; border-radius: 999px; display: inline-block; }
    .cta { text-align: center; }
    .cta-text { font-size: 26px; color: ${GOLD}; }
    .cta-url { font-size: 24px; color: #ccc; margin-top: 4px; }
    .bg-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .bg-shade { position: absolute; inset: 0;
                background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.8) 100%); }
    .topic-title { font-size: 54px; font-weight: 900; color: ${GOLD}; max-width: 880px;
                   line-height: 1.3; text-shadow: 0 4px 20px rgba(0,0,0,0.6); }
    .topic-text { font-size: 34px; color: #eee; max-width: 860px; line-height: 1.6; }
    .hook-badge { background: #c0392b; color: #fff; font-size: 22px; font-weight: 700;
                  padding: 8px 24px; border-radius: 8px; display: inline-block; margin-bottom: 16px; }
  `;
}

function dealHtml(p, photoDataUrl) {
  const discount = p.discount || (p.list && p.sold ? Math.round((1 - Number(p.sold) / Number(p.list)) * 100) : 0);
  const headerLabel = p.kind === 'client_win' ? 'זכייה של לקוח דרסו' : 'שירות מציאת רכבים';
  const bgImg = photoDataUrl
    ? `<img class="bg-photo" src="${photoDataUrl}" /><div class="bg-shade"></div>`
    : '';
  return `<!DOCTYPE html><html><head><style>${baseStyle()}</style></head><body>
<div class="card">
  ${bgImg}
  <div class="border"></div>
  <div class="header" style="position:relative;z-index:2">
    <div class="logo"><div class="logo-main">DERSO</div><div class="logo-sub">רכבים</div></div>
    <div class="header-label">${headerLabel}</div>
  </div>
  <div class="center" style="position:relative;z-index:2">
    <div class="title">${p.title || p.car_title || ''}</div>
    <div class="meta">
      ${p.year ? `<span>שנת ${p.year}</span>` : ''}
      ${p.km ? `<span>${p.km} ק"מ</span>` : ''}
    </div>
    ${p.list ? `<div class="prices">
      <span class="list-price">${nis(p.list)}</span>
      <span class="sold-price">${nis(p.sold || p.final_price)}</span>
    </div>` : ''}
    ${discount ? `<div class="badge">${discount}%- מתחת למחירון</div>` : ''}
  </div>
  <div class="cta" style="position:relative;z-index:2">
    <div class="cta-text">הצטרפו לשידור — רכבים ישירות לוואטסאפ</div>
    <div class="cta-url">auctions.derso.net</div>
  </div>
</div>
</body></html>`;
}

function topicHtml(p) {
  return `<!DOCTYPE html><html><head><style>${baseStyle()}</style></head><body>
<div class="card" style="background: linear-gradient(160deg, #1a1408 0%, ${DARK} 45%, #000 100%);">
  <div class="border"></div>
  <div class="header" style="position:relative;z-index:2">
    <div class="logo"><div class="logo-main">DERSO</div><div class="logo-sub">רכבים</div></div>
    <div class="header-label">עדכוני שוק הרכב</div>
  </div>
  <div class="center" style="position:relative;z-index:2">
    <div class="hook-badge">${p.area_label || 'נושא חם'}</div>
    <div class="topic-title">${p.topic || p.title || 'סיכום שבועי'}</div>
    <div class="topic-text">${p.text || p.facts || p.pain_point || ''}</div>
  </div>
  <div class="cta" style="position:relative;z-index:2">
    <div class="cta-text">הצטרפו לשידור — רכבים ישירות לוואטסאפ</div>
    <div class="cta-url">auctions.derso.net</div>
  </div>
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
