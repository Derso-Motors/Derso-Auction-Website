'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase-client';
import { sendCarToClient } from './actions';
import ConfirmDialog from '../../../components/ConfirmDialog';

// The add-car wizard: one simple question-group per step, like the Telegram bot.
const STEPS = [
  {
    title: 'איזה רכב מוסיפים? 🚗',
    fields: [
      { key: 'make', label: 'יצרן', placeholder: 'מרצדס', required: true },
      { key: 'model', label: 'דגם', placeholder: 'EQE 350', required: true },
      { key: 'trim_level', label: 'רמת גימור (אופציונלי)', placeholder: 'AMG Line' },
    ],
  },
  {
    title: 'קצת נתונים 📋',
    fields: [
      { key: 'year', label: 'שנתון', placeholder: '2023', type: 'number' },
      { key: 'hand', label: 'יד', placeholder: '1', type: 'number' },
      { key: 'km', label: 'קילומטראז\'', placeholder: '45000', type: 'number' },
    ],
  },
  {
    title: 'מפרט 🔧',
    fields: [
      { key: 'color', label: 'צבע', placeholder: 'שחור מטאלי' },
      { key: 'gear', label: 'גיר', placeholder: 'אוטומט' },
      { key: 'fuel', label: 'דלק', placeholder: 'חשמלי / בנזין / היברידי' },
      { key: 'engine_cc', label: 'נפח מנוע (סמ"ק)', placeholder: '2000', type: 'number' },
    ],
  },
  {
    title: 'מחירים 💰',
    fields: [
      { key: 'list_price', label: 'מחיר מחירון (₪)', placeholder: '250000', type: 'number' },
      { key: 'price', label: 'המחיר שלנו (₪)', placeholder: '215000', type: 'number' },
    ],
  },
  {
    title: 'תמונות והערות 📸',
    fields: [
      { key: 'images', label: 'קישורי תמונות (כל קישור בשורה חדשה)', type: 'textarea', placeholder: 'https://...\nhttps://...' },
      { key: 'notes', label: 'הערות פנימיות (אופציונלי)', type: 'textarea', placeholder: 'מצב מעולה, טיפול אחרון לפני חודש...' },
    ],
  },
];

const EMPTY = { make: '', model: '', trim_level: '', year: '', hand: '', km: '', color: '', gear: '', fuel: '', engine_cc: '', list_price: '', price: '', images: '', notes: '' };

function fmt(n) { return n != null && n !== '' ? Number(n).toLocaleString('he-IL') : null; }

function AddWizard({ onClose, onSaved }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dir, setDir] = useState('next');
  const last = step === STEPS.length; // summary screen

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function canAdvance() {
    if (last) return true;
    return STEPS[step].fields.every((f) => !f.required || String(form[f.key]).trim());
  }

  async function save() {
    setSaving(true); setError('');
    const supabase = createClient();
    const images = form.images.split('\n').map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s));
    const { error: err } = await supabase.from('inventory_cars').insert({
      make: form.make.trim(),
      model: form.model.trim(),
      trim_level: form.trim_level.trim() || null,
      year: form.year ? Number(form.year) : null,
      hand: form.hand ? Number(form.hand) : null,
      km: form.km ? Number(form.km) : null,
      color: form.color.trim() || null,
      gear: form.gear.trim() || null,
      fuel: form.fuel.trim() || null,
      engine_cc: form.engine_cc ? Number(form.engine_cc) : null,
      list_price: form.list_price ? Number(form.list_price) : null,
      price: form.price ? Number(form.price) : null,
      images,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (err) { setError('שגיאה בשמירה. נסה שוב.'); return; }
    onSaved();
  }

  return (
    <div className="wizard-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wizard-modal">
        <button className="wizard-close" onClick={onClose} type="button" aria-label="סגירה">✕</button>

        {/* Progress dots */}
        <div className="wizard-progress">
          {[...STEPS.map((_, i) => i), STEPS.length].map((i) => (
            <span key={i} className={`wizard-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
          ))}
        </div>

        <div key={step} className={`wizard-step ${dir === 'next' ? 'slide-in-next' : 'slide-in-prev'}`}>
          {!last ? (
            <>
              <h3 className="wizard-title">{STEPS[step].title}</h3>
              {STEPS[step].fields.map((f) => (
                <div className="field" key={f.key}>
                  <label>{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea rows={3} value={form[f.key]} placeholder={f.placeholder}
                      onChange={(e) => set(f.key, e.target.value)} />
                  ) : (
                    <input type={f.type || 'text'} value={form[f.key]} placeholder={f.placeholder}
                      dir={f.type === 'number' ? 'ltr' : undefined}
                      onChange={(e) => set(f.key, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && canAdvance()) { setDir('next'); setStep(step + 1); } }} />
                  )}
                </div>
              ))}
            </>
          ) : (
            <>
              <h3 className="wizard-title">הכל מוכן? ✅</h3>
              <div className="wizard-summary">
                <div className="wizard-summary-title">
                  {form.make} {form.model} {form.trim_level} {form.year && `· ${form.year}`}
                </div>
                <div className="wizard-summary-rows">
                  {form.hand && <span>יד {form.hand}</span>}
                  {form.km && <span>{fmt(form.km)} ק"מ</span>}
                  {form.color && <span>{form.color}</span>}
                  {form.gear && <span>{form.gear}</span>}
                  {form.fuel && <span>{form.fuel}</span>}
                </div>
                <div className="wizard-summary-price">
                  {form.list_price && <span className="strike">מחירון ₪{fmt(form.list_price)}</span>}
                  {form.price && <b>₪{fmt(form.price)}</b>}
                </div>
                {form.images.trim() && <div className="muted" style={{ fontSize: 12 }}>{form.images.split('\n').filter((s) => s.trim()).length} תמונות</div>}
              </div>
              {error && <div className="error-msg">{error}</div>}
            </>
          )}
        </div>

        <div className="wizard-nav">
          {step > 0 && (
            <button className="btn secondary" type="button" onClick={() => { setDir('prev'); setStep(step - 1); }}>
              → חזרה
            </button>
          )}
          {!last ? (
            <button className="btn" type="button" disabled={!canAdvance()}
              onClick={() => { setDir('next'); setStep(step + 1); }}>
              המשך ←
            </button>
          ) : (
            <button className="btn" type="button" disabled={saving} onClick={save}>
              {saving ? 'שומר...' : '🚗 הוספה למאגר'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Review-and-send modal: everything is editable before it goes to the client's
// "רכבים בהמלצה" list. Used both for inventory cars and for BidSpirit links.
function SendCarModal({ clients, initial, onClose, onSent }) {
  const [form, setForm] = useState({
    client_id: '', title: '', year: '', km: '', list_price: '', est_price: '',
    auction_link: '', image_url: '', notes: '', ...initial,
  });
  const [notify, setNotify] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [looking, setLooking] = useState(false);
  const [pulled, setPulled] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Paste a Bidspirit link → auto-fill the fields (admin reviews/edits before sending).
  async function pullFromLink() {
    const url = (form.auction_link || '').trim();
    if (!url) { setError('הדבק קישור Bidspirit בשדה "קישור למכרז" קודם'); return; }
    setLooking(true); setError(''); setPulled('');
    try {
      const res = await fetch('/api/lot-lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const j = await res.json().catch(() => ({ ok: false }));
      if (!j.ok) { setError(j.error || 'לא הצלחתי למשוך את הרכב מהקישור'); return; }
      setForm((f) => ({
        ...f,
        title: j.car.title || f.title,
        year: j.car.year || f.year,
        km: j.car.km || f.km,
        list_price: j.car.list_price || f.list_price,
        image_url: j.car.image_url || f.image_url,
        auction_link: j.car.auction_link || f.auction_link,
      }));
      setPulled('✓ הפרטים נמשכו — בדוק, ערוך במידת הצורך, ושלח.');
    } catch {
      setError('שגיאת תקשורת — נסה שוב');
    } finally {
      setLooking(false);
    }
  }

  async function send() {
    if (!form.client_id) { setError('בחר לקוח'); return; }
    if (!form.title.trim()) { setError('שם הרכב הוא שדה חובה'); return; }
    setSending(true); setError('');
    const res = await sendCarToClient({ ...form, notify });
    setSending(false);
    if (!res?.ok) { setError('השליחה נכשלה. נסה שוב.'); return; }
    onSent();
  }

  return (
    <div className="wizard-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wizard-modal">
        <button className="wizard-close" onClick={onClose} type="button" aria-label="סגירה">✕</button>
        <h3 className="wizard-title">שליחת רכב ללקוח 📤</h3>
        <p className="muted" style={{ fontSize: 12.5, textAlign: 'center', marginTop: -8, marginBottom: 14 }}>
          בדוק וערוך את הפרטים לפני השליחה — הרכב יופיע אצל הלקוח בעמוד "רכבים בהמלצה"
        </p>

        <div className="field">
          <label>לקוח *</label>
          <select value={form.client_id} onChange={(e) => set('client_id', e.target.value)}>
            <option value="">בחר לקוח...</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.id}</option>)}
          </select>
        </div>
        <div className="field">
          <label>שם הרכב *</label>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="מרצדס EQE 350 · 2023" />
        </div>
        <div className="grid cols-2">
          <div className="field"><label>שנתון</label><input type="number" dir="ltr" value={form.year} onChange={(e) => set('year', e.target.value)} /></div>
          <div className="field"><label>ק"מ</label><input type="number" dir="ltr" value={form.km} onChange={(e) => set('km', e.target.value)} /></div>
          <div className="field"><label>מחיר מחירון (₪)</label><input type="number" dir="ltr" value={form.list_price} onChange={(e) => set('list_price', e.target.value)} /></div>
          <div className="field"><label>מחיר משוער (₪)</label><input type="number" dir="ltr" value={form.est_price} onChange={(e) => set('est_price', e.target.value)} /></div>
        </div>
        <div className="field">
          <label>קישור למכרז (בידספיריט וכו')</label>
          <div className="row" style={{ gap: 6, alignItems: 'stretch' }}>
            <input dir="ltr" style={{ flex: 1 }} value={form.auction_link} onChange={(e) => set('auction_link', e.target.value)} placeholder="https://il.bidspirit.com/..." />
            <button className="btn secondary" type="button" disabled={looking} onClick={pullFromLink} style={{ whiteSpace: 'nowrap' }}>
              {looking ? 'מושך...' : '🔗 משוך פרטים'}
            </button>
          </div>
          {pulled && <div className="muted" style={{ fontSize: 12, color: 'var(--success, #16a34a)', marginTop: 4 }}>{pulled}</div>}
        </div>
        <div className="field">
          <label>קישור תמונה</label>
          <input dir="ltr" value={form.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://..." />
        </div>
        <div className="field">
          <label>הערות ללקוח</label>
          <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="מצב מצוין, מומלץ בחום..." />
        </div>
        <label className="row" style={{ gap: 8, fontSize: 13.5, cursor: 'pointer', marginBottom: 4 }}>
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} style={{ width: 'auto' }} />
          שלח ללקוח הודעת וואטסאפ עם קישור לרשימה
        </label>

        {error && <div className="error-msg">{error}</div>}
        <div className="wizard-nav">
          <button className="btn secondary" type="button" onClick={onClose}>ביטול</button>
          <button className="btn" type="button" disabled={sending} onClick={send}>
            {sending ? 'שולח...' : '📤 שליחה ללקוח'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InventoryClient({ initialCars, clients = [] }) {
  const router = useRouter();
  const [cars, setCars] = useState(initialCars);
  const [confirming, setConfirming] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [filter, setFilter] = useState('available');
  const [sendInitial, setSendInitial] = useState(null); // null = closed
  const [sentMsg, setSentMsg] = useState('');
  const [toastErr, setToastErr] = useState(false);

  function showToast(msg, isErr = false) {
    setToastErr(isErr);
    setSentMsg(msg);
    setTimeout(() => setSentMsg(''), 4000);
  }

  function openSendForCar(car) {
    setSendInitial({
      title: [car.make, car.model, car.trim_level].filter(Boolean).join(' ') + (car.year ? ` · ${car.year}` : ''),
      year: car.year ?? '',
      km: car.km ?? '',
      list_price: car.list_price ?? '',
      est_price: car.price ?? '',
      image_url: car.images?.[0] || '',
      notes: car.notes || '',
    });
  }

  async function reload() {
    const supabase = createClient();
    const { data } = await supabase.from('inventory_cars').select('*').order('created_at', { ascending: false });
    setCars(data || []);
    router.refresh();
  }

  function remove(car) {
    setConfirming({ type: 'delete', car });
  }

  function toggleSold(car) {
    setConfirming({ type: 'sold', car });
  }

  async function runConfirmed() {
    const { type, car } = confirming;
    setConfirming(null);
    const supabase = createClient();
    if (type === 'delete') {
      // Optimistic: drop from the list right away, restore on failure.
      const prev = cars;
      setCars((cs) => cs.filter((c) => c.id !== car.id));
      const { error } = await supabase.from('inventory_cars').delete().eq('id', car.id);
      if (error) { setCars(prev); showToast('❌ מחיקת הרכב נכשלה. נסה שוב.', true); return; }
      showToast(`🗑️ ${car.make} ${car.model} נמחק מהמאגר`);
      router.refresh();
    } else {
      const toSold = car.status !== 'sold';
      const prev = cars;
      setCars((cs) => cs.map((c) => (c.id === car.id ? { ...c, status: toSold ? 'sold' : 'available' } : c)));
      const { error } = await supabase.from('inventory_cars')
        .update({ status: toSold ? 'sold' : 'available', sold_at: toSold ? new Date().toISOString() : null })
        .eq('id', car.id);
      if (error) { setCars(prev); showToast('❌ עדכון הסטטוס נכשל. נסה שוב.', true); return; }
      showToast(toSold ? `✅ ${car.make} ${car.model} סומן כנמכר` : `↩️ ${car.make} ${car.model} הוחזר למלאי`);
      router.refresh();
    }
  }

  const shown = cars.filter((c) => (filter === 'all' ? true : c.status === filter));

  return (
    <div>
      {confirming && (
        <ConfirmDialog
          icon={confirming.type === 'delete' ? '🗑️' : confirming.car.status !== 'sold' ? '✅' : '↩️'}
          title={confirming.type === 'delete'
            ? `למחוק את ${confirming.car.make} ${confirming.car.model} מהמאגר?`
            : confirming.car.status !== 'sold'
              ? `לסמן את ${confirming.car.make} ${confirming.car.model} כנמכר?`
              : `להחזיר את ${confirming.car.make} ${confirming.car.model} למלאי?`}
          sub={confirming.type === 'delete' ? 'המחיקה מתבצעת מיד ואינה הפיכה' : 'אפשר לשנות בחזרה בכל רגע'}
          confirmLabel={confirming.type === 'delete' ? 'כן, מחיקה' : 'כן, עדכון'}
          danger={confirming.type === 'delete'}
          onConfirm={runConfirmed}
          onClose={() => setConfirming(null)}
        />
      )}
      <div className="inv-header">
        <div>
          <h1 className="page-title">מאגר רכבים 🚗</h1>
          <p className="page-sub">כלי פנימי לשיחות אפיון — רכבים שהוספו ידנית בלבד</p>
        </div>
        <button className="btn inv-add-btn" type="button" onClick={() => setWizardOpen(true)}>
          + הוספת רכב
        </button>
      </div>

      <div className="inv-filters">
        {[['available', 'במלאי'], ['sold', 'נמכרו'], ['all', 'הכל']].map(([k, label]) => (
          <button key={k} type="button" className={`inv-filter ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
            {label} ({k === 'all' ? cars.length : cars.filter((c) => c.status === k).length})
          </button>
        ))}
      </div>

      {!shown.length && <div className="empty" style={{ padding: 40 }}>אין רכבים להצגה — לחץ על "הוספת רכב" כדי להתחיל</div>}

      <div className="inv-grid">
        {shown.map((car) => (
          <div key={car.id} className={`inv-card ${car.status === 'sold' ? 'sold' : ''}`}>
            <div className="inv-card-img">
              {car.images?.length ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={car.images[0]} alt={`${car.make} ${car.model}`} />
              ) : (
                <div className="inv-card-noimg">🚗</div>
              )}
              {car.status === 'sold' && <span className="inv-sold-badge">נמכר</span>}
              {car.images?.length > 1 && <span className="inv-img-count">📷 {car.images.length}</span>}
            </div>
            <div className="inv-card-body">
              <div className="inv-card-title">
                {car.make} {car.model} {car.trim_level && <span className="muted">{car.trim_level}</span>}
              </div>
              <div className="inv-card-chips">
                {car.year && <span>{car.year}</span>}
                {car.hand != null && <span>יד {car.hand}</span>}
                {car.km != null && <span>{fmt(car.km)} ק"מ</span>}
                {car.gear && <span>{car.gear}</span>}
                {car.fuel && <span>{car.fuel}</span>}
                {car.color && <span>{car.color}</span>}
              </div>
              <div className="inv-card-price">
                {car.list_price != null && <span className="strike">₪{fmt(car.list_price)}</span>}
                {car.price != null && <b>₪{fmt(car.price)}</b>}
              </div>
              {car.notes && <div className="inv-card-notes">{car.notes}</div>}
              <div className="inv-card-actions">
                {car.status !== 'sold' && (
                  <button className="btn" type="button" onClick={() => openSendForCar(car)}>📤 שליחה ללקוח</button>
                )}
                <button className="btn secondary" type="button" onClick={() => toggleSold(car)}>
                  {car.status === 'sold' ? '↩️ החזרה למלאי' : '✅ נמכר'}
                </button>
                <button className="btn danger-outline" type="button" onClick={() => remove(car)}>🗑️ מחיקה</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Send a car straight from a BidSpirit (or any auction) link */}
      <div className="card inv-bidspirit" style={{ marginTop: 28 }}>
        <h3>שליחת רכב מקישור בידספיריט 🔗</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          מצאת רכב מעניין במכרז? הדבק קישור, מלא את הפרטים, ערוך ושלח ללקוח — בלי להוסיף אותו למאגר.
        </p>
        <button className="btn" type="button" onClick={() => setSendInitial({ auction_link: '' })}>
          📤 שליחת רכב מקישור
        </button>
      </div>

      {sentMsg && <div className={`inv-toast ${toastErr ? 'toast-err' : ''}`}>{sentMsg}</div>}

      {wizardOpen && (
        <AddWizard
          onClose={() => setWizardOpen(false)}
          onSaved={() => { setWizardOpen(false); showToast('✅ הרכב נוסף למאגר'); reload(); }}
        />
      )}
      {sendInitial !== null && (
        <SendCarModal
          clients={clients}
          initial={sendInitial}
          onClose={() => setSendInitial(null)}
          onSent={() => {
            setSendInitial(null);
            showToast('✅ הרכב נשלח ללקוח והתווסף לעמוד "רכבים בהמלצה" שלו');
          }}
        />
      )}
    </div>
  );
}
