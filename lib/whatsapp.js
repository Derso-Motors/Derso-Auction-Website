const WHATSAPP_FROM = '972559506913';

function formatPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/[\s\-\(\)\.+]/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return digits;
}

export function whatsappLink(phone, text) {
  const formatted = formatPhone(phone);
  if (!formatted) return null;
  return `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
}

// opts.replyTo — a WhatsApp message id (wamid) to quote, so the message shows
// as a reply to the original in the client's chat.
// Returns { ok, messageId } — store messageId to reply to this message later.
export async function sendWhatsApp(phone, text, opts = {}) {
  const formatted = formatPhone(phone);
  if (!formatted) return { ok: false, error: 'no phone' };

  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    // No Cloud API configured — queue the message; the office bot (Baileys)
    // polls /api/wa/outbox and sends it from the business number.
    const queued = await queueViaBot(formatted, text);
    if (queued) return { ok: true, queued: true, messageId: null };
    console.log(`[WhatsApp] Would send to ${formatted}: ${text}`);
    return { ok: true, simulated: true, messageId: null };
  }

  try {
    const body = {
      messaging_product: 'whatsapp',
      to: formatted,
      type: 'text',
      text: { body: text },
    };
    if (opts.replyTo) body.context = { message_id: opts.replyTo };

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    return { ok: res.ok, data, messageId: data?.messages?.[0]?.id || null };
  } catch (err) {
    console.error('[WhatsApp] Error:', err);
    return { ok: false, error: err.message };
  }
}

async function queueViaBot(phone, text) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return false;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
    const { error } = await admin.from('wa_outbox').insert({ phone, text });
    return !error;
  } catch {
    return false;
  }
}
