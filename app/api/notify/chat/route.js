import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '../../../../lib/supabase-server';
import { sendWhatsApp, OWNER_PHONE } from '../../../../lib/whatsapp';
import { NextResponse } from 'next/server';

// נרמול לפורמט שבו wa_outbox שומר טלפונים (972 + ספרות) — כמו formatPhone ב-lib/whatsapp
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[\s\-\(\)\.+]/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return digits;
}

// POST { clientId } — התראת וואטסאפ על הודעת צ'אט חדשה, עם הגבלת קצב של 15 דקות לכל יעד
export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const clientId = body?.clientId;
  if (!clientId) return NextResponse.json({ error: 'missing clientId' }, { status: 400 });

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    const { data: caller } = await admin.from('profiles').select('role, full_name').eq('id', user.id).single();
    const isAdmin = caller?.role === 'admin';

    let targetPhone, text;
    if (isAdmin) {
      // אדמין שלח — מודיעים ללקוח
      const { data: client } = await admin.from('profiles').select('phone').eq('id', clientId).single();
      if (!client?.phone) return NextResponse.json({ ok: false, reason: 'no phone' });
      targetPhone = normalizePhone(client.phone);
      text = 'הודעה חדשה מדרסו 💬\nלצפייה ומענה: https://auctions.derso.net/messages\n\nדרסו — בית ליווי מקצועי למכרזים';
    } else {
      // לקוח שלח — מודיעים לבעל העסק
      targetPhone = normalizePhone(OWNER_PHONE);
      text = `💬 הודעה חדשה מ${caller?.full_name || 'לקוח'} באתר`;
    }

    // Throttle: לא שולחים יותר מהתראת "הודעה חדשה" אחת ל-15 דקות לאותו מספר
    const { data: recent } = await admin.from('wa_outbox')
      .select('id')
      .eq('phone', targetPhone)
      .like('text', '%הודעה חדשה%')
      .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .limit(1);
    if (recent?.length) return NextResponse.json({ ok: true, throttled: true });

    await sendWhatsApp(targetPhone, text);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[notify:chat] failed:', err?.message || err);
    return NextResponse.json({ ok: false });
  }
}
