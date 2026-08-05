import { createClient as createSupabase } from '@supabase/supabase-js';
import { sendWhatsApp } from '../../../lib/whatsapp';
import { fmtIl } from '../../../lib/callBookings';

export const dynamic = 'force-dynamic';

const OWNER_PHONE = process.env.OWNER_PHONE || '0559506913';

function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
}

function Page({ icon, title, sub }) {
  return (
    <div className="login-page">
      <main className="login-wrap" style={{ justifyContent: 'center' }}>
        <div className="login-box verify-box" style={{ textAlign: 'center' }}>
          <div className="verify-icon big">{icon}</div>
          <h2 style={{ margin: '0 0 8px' }}>{title}</h2>
          {sub && <p className="verify-text" style={{ marginBottom: 0 }}>{sub}</p>}
        </div>
      </main>
    </div>
  );
}

// Tokened confirm/cancel landing page from the day-before WhatsApp message.
export default async function CallActionPage({ params, searchParams }) {
  const admin = serviceClient();
  if (!admin) return <Page icon="😕" title="השירות לא זמין כרגע" sub="נסה שוב מאוחר יותר" />;

  const { data: booking } = await admin.from('call_bookings').select('*').eq('token', params.token).single();
  if (!booking) return <Page icon="🔍" title="הקישור לא נמצא" sub="ייתכן שהשיחה כבר בוטלה" />;

  const when = fmtIl(booking.starts_at);
  const action = searchParams?.a;

  if (booking.status === 'cancelled') {
    return <Page icon="❌" title="השיחה הזאת כבר בוטלה" sub="אפשר לקבוע שיחה חדשה מהאזור האישי באתר" />;
  }

  if (action === 'confirm') {
    if (booking.status !== 'confirmed') {
      await admin.from('call_bookings').update({ status: 'confirmed' }).eq('id', booking.id);
      await sendWhatsApp(OWNER_PHONE, `✅ ${booking.client_name || booking.phone} אישר את שיחת האפיון ב${when}`);
    }
    return <Page icon="✅" title="השיחה אושרה!" sub={`נתקשר אליך ב${when}. נשלח תזכורת חצי שעה לפני 📞`} />;
  }

  if (action === 'cancel') {
    await admin.from('call_bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', booking.id);
    if (booking.meeting_id) await admin.from('meetings').delete().eq('id', booking.meeting_id);
    await sendWhatsApp(OWNER_PHONE, `❌ ${booking.client_name || booking.phone} ביטל את שיחת האפיון שהייתה קבועה ל${when}`);
    return <Page icon="👌" title="השיחה בוטלה" sub="המועד התפנה. אפשר לקבוע שיחה חדשה בכל רגע מהאזור האישי" />;
  }

  return <Page icon="📞" title={`שיחת אפיון — ${when}`} sub="לאישור או ביטול השתמש בקישורים שקיבלת בוואטסאפ" />;
}
