'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase-client';

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

export default function InventoryClient({ initialCars }) {
  const router = useRouter();
  const [cars, setCars] = useState(initialCars);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [filter, setFilter] = useState('available');

  async function reload() {
    const supabase = createClient();
    const { data } = await supabase.from('inventory_cars').select('*').order('created_at', { ascending: false });
    setCars(data || []);
    router.refresh();
  }

  async function remove(car) {
    if (!window.confirm(`למחוק את ${car.make} ${car.model} מהמאגר? פעולה זו אינה הפיכה.`)) return;
    const supabase = createClient();
    await supabase.from('inventory_cars').delete().eq('id', car.id);
    reload();
  }

  async function toggleSold(car) {
    const toSold = car.status !== 'sold';
    if (!window.confirm(toSold ? `לסמן את ${car.make} ${car.model} כנמכר?` : `להחזיר את ${car.make} ${car.model} למלאי?`)) return;
    const supabase = createClient();
    await supabase.from('inventory_cars')
      .update({ status: toSold ? 'sold' : 'available', sold_at: toSold ? new Date().toISOString() : null })
      .eq('id', car.id);
    reload();
  }

  const shown = cars.filter((c) => (filter === 'all' ? true : c.status === filter));

  return (
    <div>
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
                <button className="btn secondary" type="button" onClick={() => toggleSold(car)}>
                  {car.status === 'sold' ? '↩️ החזרה למלאי' : '✅ נמכר'}
                </button>
                <button className="btn danger-outline" type="button" onClick={() => remove(car)}>🗑️ מחיקה</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {wizardOpen && (
        <AddWizard
          onClose={() => setWizardOpen(false)}
          onSaved={() => { setWizardOpen(false); reload(); }}
        />
      )}
    </div>
  );
}
