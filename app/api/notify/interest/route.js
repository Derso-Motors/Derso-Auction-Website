import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '../../../../lib/supabase-server';
import { sendWhatsApp, OWNER_PHONE } from '../../../../lib/whatsapp';
import { NextResponse } from 'next/server';

// POST { carId, interest, token? } — התראה לבעל העסק כשלקוח מסמן "מעניין אותי".
// דפנסיבי בכוונה — כישלון בשליפה מחזיר { ok:false } בלי לזרוק, כדי לא להפריע לזרימת הלקוח.
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const { carId, interest, token } = body || {};
  if (interest !== 'interested' || !carId) return NextResponse.json({ ok: false });

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    // אימות: או משתמש מחובר, או טוקן תקין של רשימת המלצות (דף /r/[token])
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let clientName = null;
    if (user) {
      const { data: prof } = await admin.from('profiles').select('full_name').eq('id', user.id).single();
      clientName = prof?.full_name || null;
    } else if (token) {
      const { data: list } = await admin.from('recommendation_lists')
        .select('client_id, profiles(full_name)')
        .eq('share_token', token)
        .maybeSingle();
      if (!list) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      clientName = list.profiles?.full_name || null;
    } else {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { data: car } = await admin.from('recommended_cars').select('title').eq('id', carId).maybeSingle();
    if (!car?.title) return NextResponse.json({ ok: false });

    await sendWhatsApp(OWNER_PHONE, `⭐ ${clientName || 'לקוח'} סימן עניין ברכב: ${car.title}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[notify:interest] failed:', err?.message || err);
    return NextResponse.json({ ok: false });
  }
}
