'use server';

import { requireUser } from '../../../lib/supabase-server';
import { sendWhatsApp } from '../../../lib/whatsapp';

const LIST_TITLE = 'רכבים בהמלצה';

// Send a car (from the internal inventory or a BidSpirit link) to a client's
// "רכבים בהמלצה" list. Creates the list on first send. Optionally notifies the
// client on WhatsApp. Returns { ok, error? }.
export async function sendCarToClient(payload) {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') return { ok: false, error: 'not admin' };

  const clientId = payload.client_id;
  if (!clientId || !payload.title?.trim()) return { ok: false, error: 'missing fields' };

  // Find (or create) the client's standing recommendation list.
  let { data: list } = await supabase
    .from('recommendation_lists')
    .select('id, share_token')
    .eq('client_id', clientId)
    .eq('title', LIST_TITLE)
    .maybeSingle();

  if (!list) {
    const { data: created, error: cErr } = await supabase
      .from('recommendation_lists')
      .insert({ client_id: clientId, title: LIST_TITLE })
      .select('id, share_token')
      .single();
    if (cErr) return { ok: false, error: cErr.message };
    list = created;
  }

  const { error: iErr } = await supabase.from('recommended_cars').insert({
    list_id: list.id,
    title: payload.title.trim(),
    year: payload.year ? Number(payload.year) : null,
    km: payload.km ? Number(payload.km) : null,
    list_price: payload.list_price ? Number(payload.list_price) : null,
    est_price: payload.est_price ? Number(payload.est_price) : null,
    auction_link: /^https?:\/\//.test(payload.auction_link || '') ? payload.auction_link.trim() : null,
    image_url: /^https?:\/\//.test(payload.image_url || '') ? payload.image_url.trim() : null,
    notes: payload.notes?.trim() || null,
  });
  if (iErr) return { ok: false, error: iErr.message };

  if (payload.notify) {
    const { data: profile } = await supabase.from('profiles').select('phone, full_name').eq('id', clientId).single();
    if (profile?.phone) {
      const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://derso.co.il';
      const msg = `שלום ${profile.full_name || ''},\nהוספנו לך רכב חדש לרשימת "${LIST_TITLE}" 🚗\n${payload.title.trim()}\nלצפייה: ${site}/r/${list.share_token}\n\nדרסו מוטורס — ליווי למכרזים`;
      try { await sendWhatsApp(profile.phone, msg); } catch {}
    }
  }

  return { ok: true };
}
