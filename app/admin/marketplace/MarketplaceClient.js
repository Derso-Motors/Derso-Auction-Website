'use client';

import { useState, useRef } from 'react';

const MAKES = [
  'טויוטה', 'יונדאי', 'קיה', 'מאזדה', 'סקודה', 'סוזוקי', 'מיצובישי',
  'ניסאן', 'שברולט', 'פולקסווגן', 'סיאט', 'פיאט', 'רנו', 'פיג\'ו',
  'סיטראון', 'הונדה', 'סובארו', 'BMW', 'מרצדס', 'אאודי', 'וולוו',
  'פורד', 'אופל', 'דאצ\'יה', 'MG', 'BYD', 'גילי', 'צ\'רי',
];

function parseBidspirit(text) {
  const result = { title: '', year: '', make: '', model: '', km: '', price: '', description: '', images: [] };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const yearMatch = text.match(/\b(20[0-2]\d|19\d\d)\b/);
  if (yearMatch) result.year = yearMatch[1];

  const kmMatch = text.match(/(\d[\d,.']*)(\s*)ק"?מ/i) || text.match(/(\d[\d,.']*)(\s*)km/i);
  if (kmMatch) result.km = kmMatch[1].replace(/[,.']/g, '');

  const priceMatch = text.match(/₪\s*([\d,.']+)/) || text.match(/([\d,.']+)\s*₪/) || text.match(/(\d[\d,.']*)(\s*)ש"ח/);
  if (priceMatch) result.price = priceMatch[1].replace(/[,.']/g, '');

  for (const make of MAKES) {
    if (text.includes(make)) {
      result.make = make;
      break;
    }
  }
  const engMakes = { toyota: 'Toyota', hyundai: 'Hyundai', kia: 'Kia', mazda: 'Mazda', skoda: 'Skoda',
    suzuki: 'Suzuki', mitsubishi: 'Mitsubishi', nissan: 'Nissan', chevrolet: 'Chevrolet',
    volkswagen: 'Volkswagen', seat: 'Seat', fiat: 'Fiat', renault: 'Renault', peugeot: 'Peugeot',
    citroen: 'Citroen', honda: 'Honda', subaru: 'Subaru', bmw: 'BMW', mercedes: 'Mercedes',
    audi: 'Audi', volvo: 'Volvo', ford: 'Ford', opel: 'Opel', dacia: 'Dacia', mg: 'MG', byd: 'BYD' };
  const lower = text.toLowerCase();
  for (const [eng, label] of Object.entries(engMakes)) {
    if (lower.includes(eng)) {
      if (!result.make) result.make = label;
      break;
    }
  }

  const models = ['קורולה', 'יאריס', 'קאמרי', 'C-HR', 'RAV4', 'לנד קרוזר', 'היילקס',
    'טוסון', 'קונה', 'איוניק', 'i10', 'i20', 'i30', 'i35', 'סנטה פה',
    'ספורטאז\'', 'סורנטו', 'פיקאנטו', 'סטוניק', 'ניירו', 'EV6',
    'אוקטביה', 'פאביה', 'סופרב', 'קארוק', 'קודיאק',
    'ויטרה', 'סוויפט', 'בלנו', 'ג\'ימני', 'S-Cross',
    'אאוטלנדר', 'ASX', 'אקליפס',
    'קשקאי', 'ג\'וק', 'מיקרה', 'ליף', 'X-Trail',
    'גולף', 'פולו', 'טיגואן', 'T-Cross', 'T-Roc', 'פאסאט',
    'לאון', 'איביזה', 'ארונה', 'אטקה',
    '500', 'פנדה', 'טיפו',
    'קליאו', 'מגאן', 'קפצ\'ור', 'דאסטר',
    'סיוויק', 'ג\'אז', 'HR-V', 'CR-V',
    'אימפרזה', 'XV', 'פורסטר', 'אאוטבק',
    'סדרה 3', 'סדרה 1', 'X1', 'X3', 'X5', 'iX',
    'A-Class', 'C-Class', 'GLA', 'GLB', 'GLC',
    'A3', 'A4', 'Q3', 'Q5',
    'XC40', 'XC60', 'S60', 'V40',
    'פוקוס', 'פיאסטה', 'קוגה', 'פומה',
    'קורסה', 'אסטרה', 'מוקה', 'גרנדלנד'];
  for (const model of models) {
    if (text.includes(model)) {
      result.model = model;
      break;
    }
  }

  const titleLine = lines.find(l => l.length > 5 && l.length < 100 && !l.startsWith('http'));
  if (titleLine) result.title = titleLine;
  if (!result.title && result.make) {
    result.title = [result.make, result.model, result.year].filter(Boolean).join(' ');
  }

  const imgMatches = text.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)[^\s"'<>]*/gi);
  if (imgMatches) result.images = [...new Set(imgMatches)].slice(0, 20);

  result.description = lines.slice(0, 30).join('\n');

  return result;
}

function generateFBDescription(data) {
  const parts = [];
  if (data.title) parts.push(`🚗 ${data.title}`);
  if (data.year) parts.push(`📅 שנתון: ${data.year}`);
  if (data.km) parts.push(`🛣️ ק"מ: ${Number(data.km).toLocaleString()}`);
  if (data.price) parts.push(`💰 מחיר: ₪${Number(data.price).toLocaleString()}`);
  parts.push('');
  if (data.customNotes) parts.push(data.customNotes);
  parts.push('');
  parts.push('📞 לפרטים נוספים — דרסו ליווי למכרזים');
  parts.push('🔗 www.derso-motors.co.il');
  return parts.filter((p, i) => p !== '' || (i > 0 && parts[i-1] !== '')).join('\n');
}

export default function MarketplaceClient() {
  const [rawText, setRawText] = useState('');
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState({});
  const descRef = useRef(null);

  function handleParse() {
    const parsed = parseBidspirit(rawText);
    setData({ ...parsed, customNotes: '' });
  }

  function handleCopy(field, value) {
    navigator.clipboard.writeText(value);
    setCopied(prev => ({ ...prev, [field]: true }));
    setTimeout(() => setCopied(prev => ({ ...prev, [field]: false })), 2000);
  }

  function handleCopyAll() {
    if (!data) return;
    const all = `כותרת: ${data.title}\nשנתון: ${data.year}\nיצרן: ${data.make}\nדגם: ${data.model}\nמחיר: ${data.price}\n\n${generateFBDescription(data)}`;
    navigator.clipboard.writeText(all);
    setCopied(prev => ({ ...prev, all: true }));
    setTimeout(() => setCopied(prev => ({ ...prev, all: false })), 2000);
  }

  return (
    <>
      <div className="page-title">העלאה למכירה</div>
      <div className="page-sub">הדבק טקסט מ-BidSpirit ← קבל שדות מוכנים להעתקה ל-Facebook Marketplace</div>

      <div className="admin-desktop-layout">
        <div className="admin-col-right">
          <div className="card">
            <h3>הדבקת טקסט מ-BidSpirit</h3>
            <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
              פתח את עמוד הרכב ב-BidSpirit → סמן הכל (Ctrl+A) → העתק (Ctrl+C) → הדבק כאן
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="הדבק כאן את הטקסט מעמוד BidSpirit..."
              style={{ minHeight: 200, resize: 'vertical' }}
            />
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <button className="btn" onClick={handleParse} disabled={!rawText.trim()}>
                פענוח אוטומטי
              </button>
              <button className="btn secondary" onClick={() => { setRawText(''); setData(null); }}>
                נקה
              </button>
            </div>
          </div>

          {data && (
            <div className="card">
              <h3>עריכה ידנית</h3>
              <div className="grid cols-2">
                <div className="field">
                  <label>כותרת (Title)</label>
                  <input value={data.title} onChange={(e) => setData(d => ({ ...d, title: e.target.value }))} />
                </div>
                <div className="field">
                  <label>מחיר (Price)</label>
                  <input value={data.price} onChange={(e) => setData(d => ({ ...d, price: e.target.value }))} type="number" dir="ltr" />
                </div>
                <div className="field">
                  <label>שנתון (Year)</label>
                  <input value={data.year} onChange={(e) => setData(d => ({ ...d, year: e.target.value }))} type="number" dir="ltr" />
                </div>
                <div className="field">
                  <label>יצרן (Make)</label>
                  <input value={data.make} onChange={(e) => setData(d => ({ ...d, make: e.target.value }))} />
                </div>
                <div className="field">
                  <label>דגם (Model)</label>
                  <input value={data.model} onChange={(e) => setData(d => ({ ...d, model: e.target.value }))} />
                </div>
                <div className="field">
                  <label>ק"מ</label>
                  <input value={data.km} onChange={(e) => setData(d => ({ ...d, km: e.target.value }))} type="number" dir="ltr" />
                </div>
              </div>
              <div className="field">
                <label>הערות נוספות (יתוספו לתיאור)</label>
                <textarea
                  value={data.customNotes}
                  onChange={(e) => setData(d => ({ ...d, customNotes: e.target.value }))}
                  placeholder="מצב מכני מצוין, ללא תאונות..."
                  style={{ minHeight: 80, resize: 'vertical' }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="admin-col-left">
          {data ? (
            <>
              <div className="card">
                <div className="row between" style={{ marginBottom: 16 }}>
                  <h3 style={{ margin: 0 }}>שדות ל-Facebook</h3>
                  <button className="btn small" onClick={handleCopyAll}>
                    {copied.all ? '✓ הועתק' : 'העתק הכל'}
                  </button>
                </div>

                <CopyField label="Title (כותרת)" value={data.title} copied={copied.title} onCopy={() => handleCopy('title', data.title)} />
                <CopyField label="Price (מחיר)" value={data.price ? `₪${Number(data.price).toLocaleString()}` : ''} copied={copied.price} onCopy={() => handleCopy('price', data.price)} />
                <CopyField label="Year (שנתון)" value={data.year} copied={copied.year} onCopy={() => handleCopy('year', data.year)} />
                <CopyField label="Make (יצרן)" value={data.make} copied={copied.make} onCopy={() => handleCopy('make', data.make)} />
                <CopyField label="Model (דגם)" value={data.model} copied={copied.model} onCopy={() => handleCopy('model', data.model)} />
                <CopyField label="Mileage (ק”מ)" value={data.km ? Number(data.km).toLocaleString() : ''} copied={copied.km} onCopy={() => handleCopy('km', data.km)} />
              </div>

              <div className="card">
                <div className="row between" style={{ marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}>תיאור מוכן</h3>
                  <button className="btn small" onClick={() => handleCopy('desc', generateFBDescription(data))}>
                    {copied.desc ? '✓ הועתק' : 'העתק תיאור'}
                  </button>
                </div>
                <pre ref={descRef} style={{
                  whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.7,
                  background: 'var(--surface-lowest)', padding: 16, borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit',
                  cursor: 'pointer',
                }} onClick={() => handleCopy('desc', generateFBDescription(data))}>
                  {generateFBDescription(data)}
                </pre>
              </div>

              {data.images.length > 0 && (
                <div className="card">
                  <h3>תמונות ({data.images.length})</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                    {data.images.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={`תמונה ${i + 1}`} style={{
                          width: '100%', height: 90, objectFit: 'cover', borderRadius: 'var(--radius)',
                          border: '1px solid var(--border)',
                        }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card">
              <div className="empty" style={{ padding: '60px 20px' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>הדבק טקסט מ-BidSpirit</div>
                <div style={{ maxWidth: 280, margin: '0 auto' }}>
                  העתק את כל הטקסט מעמוד הרכב ולחץ על "פענוח אוטומטי" כדי לקבל את השדות מוכנים
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function CopyField({ label, value, copied, onCopy }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, color: value ? 'var(--text)' : 'var(--muted-dim)' }}>
          {value || '—'}
        </div>
      </div>
      {value && (
        <button
          className="btn small secondary"
          onClick={onCopy}
          style={{ flexShrink: 0, minWidth: 70 }}
        >
          {copied ? '✓' : 'העתק'}
        </button>
      )}
    </div>
  );
}
