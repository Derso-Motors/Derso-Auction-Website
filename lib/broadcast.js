import { sendWhatsApp } from './whatsapp';

export function ilHour() {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: 'numeric', hour12: false }).format(new Date()));
}

export function ilDate(iso) {
  return new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(iso));
}

export function carMessage(item) {
  const d = item.details || {};
  const lines = [
    `🚗 ${item.title}`,
    d.year && `שנתון: ${d.year}`,
    d.km && `ק"מ: ${Number(d.km).toLocaleString('he-IL')}`,
    d.list_price && `מחיר מחירון: ₪${Number(d.list_price).toLocaleString('he-IL')}`,
    d.est_price && `מחיר משוער: ₪${Number(d.est_price).toLocaleString('he-IL')}`,
    d.auction_link && `לצפייה במכרז: ${d.auction_link}`,
    d.notes && `📝 ${d.notes}`,
  ].filter(Boolean);
  return `${lines.join('\n')}\n\nדרסו מוטורס — ליווי למכרזים`;
}

// Send every due pending item. Works with any supabase client that can read/write
// the broadcast tables (admin session or service role). Returns how many sent.
export async function processDueItems(supabase) {
  const { data: settings } = await supabase.from('broadcast_settings').select('*').eq('id', 1).single();
  if (settings?.paused) return 0;
  const h = ilHour();
  const { quiet_start: qs = 21, quiet_end: qe = 9 } = settings || {};
  const quiet = qs > qe ? (h >= qs || h < qe) : (h >= qs && h < qe);
  if (quiet) return 0;

  const { data: due } = await supabase
    .from('broadcast_queue')
    .select('*, profiles(full_name, phone)')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .limit(30);

  let sent = 0;
  for (const item of due || []) {
    let waId = null;
    if (item.profiles?.phone) {
      const res = await sendWhatsApp(item.profiles.phone, carMessage(item));
      if (!res.ok) continue;
      waId = res.messageId;
    }
    await supabase.from('broadcast_queue')
      .update({ status: 'sent', sent_at: new Date().toISOString(), wa_message_id: waId })
      .eq('id', item.id);
    sent++;
  }
  return sent;
}
