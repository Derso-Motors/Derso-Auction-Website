import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

// Per-user rate limiter: 15 requests per minute
const userRateLimitMap = new Map();
const USER_RATE_LIMIT_MAX = 15;
const USER_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

function checkUserRateLimit(userId) {
  const now = Date.now();
  const entry = userRateLimitMap.get(userId);
  if (!entry || now - entry.start > USER_RATE_LIMIT_WINDOW) {
    userRateLimitMap.set(userId, { start: now, count: 1 });
    return true;
  }
  if (entry.count >= USER_RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

const DAYS = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6 };

function ilNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
}
function fmtWhen(iso) {
  return new Date(iso).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' });
}

// Heuristic Hebrew parser — fallback when no AI key is configured.
function heuristicParse(text) {
  const t = text.trim();
  let type = 'task';
  if (/פגישה|קבע|להיפגש/.test(t)) type = 'meeting';
  else if (/הערה|לזכור|רשום ש|תרשום ש/.test(t)) type = 'note';
  else if (/תזכיר|תזכורת|משימה/.test(t)) type = 'task';

  const now = ilNow();
  let day = null;
  if (/מחרתיים/.test(t)) { day = new Date(now); day.setDate(day.getDate() + 2); }
  else if (/מחר/.test(t)) { day = new Date(now); day.setDate(day.getDate() + 1); }
  else if (/היום/.test(t)) { day = new Date(now); }
  else {
    const wd = t.match(/ביום ([א-ת]+)/);
    if (wd && DAYS[wd[1]] !== undefined) {
      day = new Date(now);
      let diff = (DAYS[wd[1]] - day.getDay() + 7) % 7; if (diff === 0) diff = 7;
      day.setDate(day.getDate() + diff);
    }
    const dm = t.match(/\b(\d{1,2})[./](\d{1,2})\b/);
    if (!day && dm) {
      day = new Date(now.getFullYear(), Number(dm[2]) - 1, Number(dm[1]));
      if (day < now) day.setFullYear(day.getFullYear() + 1);
    }
  }
  const tm = t.match(/ב-?(\d{1,2})(?::(\d{2}))?\b/) || t.match(/בשעה (\d{1,2})(?::(\d{2}))?(\b|$)/);
  let due_at = null;
  if (day || tm) {
    const d = day || new Date(now);
    const h = tm ? Number(tm[1]) : 9;
    const m = tm && tm[2] ? Number(tm[2]) : 0;
    if (h >= 0 && h <= 23) {
      const pad = (n) => String(n).padStart(2, '0');
      due_at = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}:00+03:00`;
    }
  }
  const title = t
    .replace(/^(תזכיר לי|תזכורת|משימה|הערה|רשום|תרשום|קבע|פגישה עם|פגישה)[:\s]*/,'')
    .replace(/מחרתיים|מחר|היום|ביום [א-ת]+/g, '')
    .replace(/ב-?\d{1,2}(:\d{2})?\b/g, '')
    .replace(/בשעה \d{1,2}(:\d{2})?/g, '')
    .replace(/\s+/g, ' ').trim() || t;
  const who = t.match(/עם ([א-ת]+)/);
  return { type, title: type === 'meeting' && who ? `פגישה עם ${who[1]} — ${title}` : title, due_at, client_name: who ? who[1] : null, location: (t.match(/במשרד|בטלפון|בזום/) || [null])[0] };
}

async function aiParse(text) {
  const key = process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!key) { console.warn('[assistant:admin] no AI key set — using heuristic'); return null; }
  const model = process.env.AI_MODEL || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
  const nowIL = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'full', timeStyle: 'short' });
  try {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 15000);
    const res = await fetch(`${(process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      signal: abortController.signal,
      body: JSON.stringify({
        stream: false,
        model,
        messages: [{ role: 'user', content:
          `אתה עוזר אישי של בעל עסק לליווי מכרזי רכב. עכשיו בישראל: ${nowIL}.\nהמשפט שלו: "${text}"\n` +
          `החזר JSON בלבד: {"type":"meeting|task|note","title":"<כותרת קצרה>","details":"<פרטים או null>","due_at":"<ISO עם +03:00 או null; חשב 'מחר'/ימים מהיום>","client_name":"<שם או null>","location":"<מיקום או null>"}` }],
        temperature: 0.2, max_tokens: 250,
      }),
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[assistant:admin] AI upstream HTTP ${res.status} model=${model} body=${errText.slice(0, 300)}`);
      return null;
    }
    const j = await res.json();
    const out = j?.choices?.[0]?.message?.content || '';
    const a = out.indexOf('{'), b = out.lastIndexOf('}');
    if (a === -1) { console.warn('[assistant:admin] AI returned no JSON — using heuristic'); return null; }
    const parsed = JSON.parse(out.slice(a, b + 1));
    return parsed?.title ? parsed : null;
  } catch (e) { console.error('[assistant:admin] AI call failed:', e?.name || '', e?.message || ''); return null; }
}

async function postAppsScript(payload) {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) return null;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), redirect: 'follow' });
    return await res.json().catch(() => null);
  } catch { return null; }
}

export async function POST(req) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ reply: 'צריך להתחבר קודם 🙂' }, { status: 401 });
  if (!checkUserRateLimit(user.id)) return Response.json({ reply: 'יותר מדי בקשות — נסה שוב בעוד דקה 🙏' }, { status: 429 });
  const { data: p } = await supabase.from('profiles').select('role, full_name, credits').eq('id', user.id).single();
  const isAdmin = p?.role === 'admin';

  let body;
  try { body = await req.json(); } catch { return Response.json({ reply: 'לא הבנתי 🤔' }, { status: 400 }); }
  const text = (body?.message || '').trim();
  if (!text) return Response.json({ reply: 'כתוב לי משהו 🙂' });

  // ── Client mode: answers ONLY from the signed-in client's own data.
  // The queries run with the client's session, so RLS physically limits every
  // row to their account — other clients' data cannot be returned.
  if (!isAdmin) {
    return clientAnswer(supabase, user, p, text);
  }

  // "What's on today?"
  if (/^(מה יש( לי)?( היום)?|היום\??|הלו"ז|מה הלו"ז)/.test(text)) {
    const now = new Date();
    const start = new Date(now); start.setHours(start.getHours() - 24);
    const [{ data: meetings }, { data: tasks }] = await Promise.all([
      supabase.from('meetings').select('title, scheduled_at, client_name, profiles(full_name)').gte('scheduled_at', now.toISOString().slice(0, 10)).order('scheduled_at').limit(8),
      supabase.from('admin_tasks').select('title, due_at').eq('done', false).order('due_at', { ascending: true, nullsFirst: false }).limit(8),
    ]);
    const mLines = (meetings || []).map((m) => `📅 ${fmtWhen(m.scheduled_at)} — ${m.title} (${m.profiles?.full_name || m.client_name || ''})`);
    const tLines = (tasks || []).map((t) => `☑️ ${t.title}${t.due_at ? ` — ${fmtWhen(t.due_at)}` : ''}`);
    const reply = [...mLines, ...tLines].join('\n') || 'הכל פנוי — אין פגישות ואין משימות פתוחות 🎉';
    return Response.json({ reply });
  }

  const parsed = (await aiParse(text)) || heuristicParse(text);

  if (parsed.type === 'meeting' && parsed.due_at) {
    const { error } = await supabase.from('meetings').insert({
      client_id: null,
      client_name: parsed.client_name || null,
      title: parsed.title,
      scheduled_at: new Date(parsed.due_at).toISOString(),
      location: parsed.location || null,
    });
    if (error) return Response.json({ reply: `לא הצלחתי לרשום את הפגישה 😕 (${error.message})` });
    const cal = await postAppsScript({ action: 'createMeeting', title: parsed.title, startISO: parsed.due_at, durationMin: 60, notes: parsed.details || '' });
    return Response.json({
      reply: `📅 קבעתי: *${parsed.title}*\n🕓 ${fmtWhen(parsed.due_at)}${parsed.location ? `\n📍 ${parsed.location}` : ''}\n✅ נוסף ליומן באתר${cal ? ' וגם ליומן גוגל' : ''}`,
    });
  }

  const kind = parsed.type === 'note' ? 'note' : 'task';
  const { error } = await supabase.from('admin_tasks').insert({
    kind,
    title: parsed.title,
    details: parsed.details || null,
    due_at: parsed.due_at || null,
    remind: !!parsed.due_at,
    source: 'assistant',
  });
  if (error) return Response.json({ reply: `לא הצלחתי לרשום 😕 (${error.message})` });
  return Response.json({
    reply: `${kind === 'note' ? '📝 רשמתי את ההערה' : '☑️ רשמתי משימה'}: *${parsed.title}*` +
      (parsed.due_at ? `\n⏰ אזכיר לך בוואטסאפ ב-${fmtWhen(parsed.due_at)}` : '') +
      `\nרואים הכל בעמוד "משימות והיום"`,
  });
}


/* ── Client service mode ────────────────────────────────────────────────────── */

const STAGES = ['זכייה במכרז', 'תשלום למכרז', 'שחרור הרכב', 'העברת בעלות', 'שינוע הרכב', 'מסירה ללקוח'];
const PRICES =
  'המחירון שלנו:\n' +
  '• בדיקת "טופס סליקה" — 350 ₪\n' +
  '• סרטון מנוע רץ + טופס סליקה — 995 ₪\n' +
  '• דמי ליווי לרכישה — 3,500 ₪';

async function clientAnswer(supabase, user, profile, text) {
  // Everything below is RLS-scoped to this client only.
  const [{ data: cars }, { data: meetings }, { data: orders }, { data: recLists }] = await Promise.all([
    supabase.from('cars').select('title, year, current_stage, won_price').eq('client_id', user.id).limit(10),
    supabase.from('meetings').select('title, scheduled_at, location').eq('client_id', user.id).gte('scheduled_at', new Date().toISOString()).order('scheduled_at').limit(5),
    supabase.from('report_orders').select('status, created_at').eq('client_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('recommendation_lists').select('recommended_cars(title, client_interest)').eq('client_id', user.id),
  ]);

  const carLines = (cars || []).map((c) => {
    const stage = c.current_stage >= 6 ? 'הושלם ✅' : (STAGES[(c.current_stage || 1) - 1] || 'בתהליך');
    return `🚗 ${c.title}${c.year ? ` (${c.year})` : ''} — שלב נוכחי: ${stage}`;
  });
  const meetLines = (meetings || []).map((m) => `📅 ${fmtWhen(m.scheduled_at)} — ${m.title}${m.location ? ` (${m.location})` : ''}`);
  const recCars = (recLists || []).flatMap((l) => l.recommended_cars || []);

  // AI mode: answer from this context only, with hard guardrails.
  const key = process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (key) {
    const model = process.env.AI_MODEL || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
    const context =
      `שם הלקוח: ${profile?.full_name || ''}\n` +
      `יתרת קרדיטים: ₪${Number(profile?.credits || 0).toLocaleString('he-IL')}\n` +
      `הרכבים שלו בתהליך:\n${carLines.join('\n') || '(אין)'}\n` +
      `הפגישות הקרובות שלו:\n${meetLines.join('\n') || '(אין)'}\n` +
      `הזמנות דוחות: ${(orders || []).length}\n` +
      `רכבים בהמלצה עבורו: ${recCars.length}\n${PRICES}\n` +
      `מידע כללי: שחרור רכב אחרי זכייה תלוי בכונס הנכסים ואורך בדרך כלל מספר ימי עסקים עד כשבועיים; שלבי הליווי הם: ${STAGES.join(' ← ')}.`;
    try {
      const clientAbort = new AbortController();
      const clientTimeout = setTimeout(() => clientAbort.abort(), 15000);
      const res = await fetch(`${(process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        signal: clientAbort.signal,
        body: JSON.stringify({
          stream: false,
          model,
          messages: [{ role: 'user', content:
            `אתה נציג שירות של "דרסו — בית ליווי מקצועי למכרזים" בצ'אט האזור האישי.\n` +
            `הנתונים של הלקוח המחובר (אלה הנתונים היחידים שמותר להשתמש בהם):\n${context}\n\n` +
            `שאלת הלקוח: "${text}"\n\n` +
            `חוקים מחייבים: ענה רק מהנתונים למעלה. לעולם אל תמציא מידע, אל תזכיר לקוחות אחרים ואל תמסור עליהם דבר. אל תבטיח הבטחות (מחירי זכייה, מועדים מדויקים, תוצאות). אם אינך יודע — הפנה לכתוב לנו בעמוד "שאלות ופניות" או בטלפון 055-950-6913. השב בעברית, קצר וחם.` }],
          temperature: 0.3, max_tokens: 300,
        }),
      });
      clearTimeout(clientTimeout);
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[assistant:client] AI upstream HTTP ${res.status} model=${model} body=${errText.slice(0, 300)}`);
      } else {
        const j = await res.json();
        const out = j?.choices?.[0]?.message?.content?.trim();
        if (out) return Response.json({ reply: out });
        console.warn('[assistant:client] AI returned empty content — using fallback');
      }
    } catch (e) { console.error('[assistant:client] AI call failed:', e?.name || '', e?.message || ''); }
  } else {
    console.warn('[assistant:client] no AI key set — using keyword fallback');
  }

  // Fallback: keyword answers from the same RLS-scoped data.
  if (/רכב|סטטוס|שחרור|איפה|מתי/.test(text) && carLines.length) {
    return Response.json({ reply: `הרכבים שלך:\n${carLines.join('\n')}\n\nשחרור רכב תלוי בכונס ואורך בדרך כלל מספר ימי עסקים. לפרטים מדויקים — כתוב לנו בהודעות 🙂` });
  }
  if (/פגיש/.test(text)) {
    return Response.json({ reply: meetLines.length ? `הפגישות הקרובות שלך:\n${meetLines.join('\n')}` : 'אין לך פגישות קרובות. רוצה לקבוע? כתוב לנו בעמוד "שאלות ופניות" 🙂' });
  }
  if (/מחיר|עולה|כמה|תשלום/.test(text)) {
    return Response.json({ reply: PRICES + '\n\nיתרת הקרדיטים שלך: ₪' + Number(profile?.credits || 0).toLocaleString('he-IL') });
  }
  if (/קרדיט/.test(text)) {
    return Response.json({ reply: `יתרת הקרדיטים שלך: ₪${Number(profile?.credits || 0).toLocaleString('he-IL')}` });
  }
  if (/דוח/.test(text)) {
    return Response.json({ reply: (orders || []).length ? `יש לך ${(orders || []).length} הזמנות דוחות. את הסטטוס המלא רואים בעמוד "דוחות ותשלומים".` : 'עוד לא הזמנת דוחות. אפשר להזמין בעמוד "דוחות ותשלומים" 🙂' });
  }
  if (/המלצ/.test(text)) {
    return Response.json({ reply: recCars.length ? `יש ${recCars.length} רכבים בעמוד "רכבים בהמלצה" שלך — שווה להציץ ולסמן מה מעניין 🚗` : 'עוד אין רכבים בהמלצה — ברגע שנמצא התאמה היא תופיע שם.' });
  }
  return Response.json({ reply: 'אשמח לעזור! אפשר לשאול אותי על: הרכבים שלך והשלב שלהם 🚗, הפגישות שלך 📅, מחירים 💰, קרדיטים, דוחות ורכבים בהמלצה.\nלשאלה מורכבת — כתוב לנו בעמוד "שאלות ופניות" ונחזור אליך.' });
}
