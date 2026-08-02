const WHATSAPP_FROM = '972559506913';

function formatPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/[\s\-\(\)\.+]/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return digits;
}

export async function sendWhatsApp(phone, text) {
  const formatted = formatPhone(phone);
  if (!formatted) return { ok: false, error: 'no phone' };

  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.log(`[WhatsApp] Would send to ${formatted}: ${text}`);
    return { ok: true, simulated: true };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formatted,
          type: 'text',
          text: { body: text },
        }),
      },
    );
    const json = await res.json();
    if (!res.ok) {
      console.error('[WhatsApp] API error', json);
      return { ok: false, error: json };
    }
    return { ok: true, id: json.messages?.[0]?.id };
  } catch (err) {
    console.error('[WhatsApp] fetch error', err);
    return { ok: false, error: err.message };
  }
}

export function whatsappLink(phone, text) {
  const formatted = formatPhone(phone);
  if (!formatted) return '#';
  return `https://wa.me/${formatted}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}
