import Shell from '../../../components/Shell';
import { requireAdmin } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { SubmitButton, DeleteButton } from '../../../components/SubmitButton';
import { timeAgo } from '../../../lib/utils';
import AutoSubmitSelect from '../../../components/AutoSubmitSelect';
import { sendWhatsApp } from '../../../lib/whatsapp';
import { lookupLot } from '../../../lib/bidspirit';

export const dynamic = 'force-dynamic';

const AUCTION_STATUSES = [
  'transfer10', 'redemption', 'transfer90', 'ownership_order', 'licensing', 'released',
  // legacy values still accepted on existing rows
  'submitted', 'under_review', 'won', 'lost', 'cancelled', 'pending_release',
];
const STAGE_OPTIONS = [
  ['transfer10', 'העברת 10%'],
  ['redemption', 'זכות פידיון'],
  ['transfer90', 'העברת 90%'],
  ['ownership_order', 'הזמנת צו העברת בעלות'],
  ['licensing', 'אישורי משרד הרישוי'],
  ['released', 'משוחרר — בדרך אליך'],
];

async function addWinByLink(formData) {
  'use server';
  const { supabase } = await requireAdmin();

  const link = String(formData.get('link') || '').trim();
  const P = '/admin/auctions';
  const looked = await lookupLot(link);
  if (!looked.ok) redirect(P + '?err=' + encodeURIComponent(looked.error || 'שליפת הרכב נכשלה'));

  const car = looked.car;
  const auctionDate = formData.get('auction_date') || car.auction_date || new Date().toISOString().slice(0, 10);
  const row = {
    client_id: formData.get('client_id') || null,
    car_title: car.title + (car.km ? ` · ${Number(String(car.km).replace(/[^\d]/g, '')) ? Number(String(car.km).replace(/[^\d]/g, '')).toLocaleString() + ' ק"מ' : car.km}` : ''),
    auction_source: 'BidSpirit',
    case_number: car.license_plate || null,
    max_bid: Number(formData.get('final_price')) || Number(String(car.list_price).replace(/[^\d]/g, '')) || 0,
    final_price: Number(formData.get('final_price')) || Number(String(car.list_price).replace(/[^\d]/g, '')) || null,
    list_price: Number(String(car.list_price).replace(/[^\d]/g, '')) || null,
    closing_date: auctionDate,
    status: 'won',
    auction_link: link,
  };
  const { error } = await supabase.from('auctions').insert(row);
  if (error) redirect(P + '?err=' + encodeURIComponent('הוספת הזכייה נכשלה'));
  revalidatePath(P);
  redirect(P + '?ok=' + encodeURIComponent(`🏆 הזכייה נרשמה: ${car.title}`));
}

async function updateAuctionStatus(formData) {
  'use server';
  const { supabase } = await requireAdmin();
  const status = formData.get('status');
  if (!AUCTION_STATUSES.includes(status)) redirect('/admin/auctions?err=' + encodeURIComponent('סטטוס לא תקין'));
  const patch = { status };
  const finalPrice = formData.get('final_price');
  if (finalPrice) {
    const fp = Number(finalPrice);
    if (Number.isFinite(fp)) patch.final_price = fp;
  }
  const auctionId = formData.get('auction_id');
  const { error } = await supabase.from('auctions').update(patch).eq('id', auctionId);
  if (error) redirect('/admin/auctions?err=' + encodeURIComponent('עדכון הסטטוס נכשל'));

  if (['won', 'lost', 'pending_release', 'transfer10', 'redemption', 'transfer90', 'ownership_order', 'licensing', 'released'].includes(status)) {
    const { data: auction } = await supabase.from('auctions').select('car_title, client_id, profiles(full_name, phone)').eq('id', auctionId).single();
    const phone = auction?.profiles?.phone;
    const name = auction?.profiles?.full_name || '';
    if (phone) {
      const statusMsg = {
      won: '🎉 זכית', lost: '❌ לא זכית', pending_release: '⏳ ממתין לשחרור',
      transfer10: '💸 שלב העברת 10% החל', redemption: '⏳ בתקופת זכות פידיון (7 ימים)',
      transfer90: '💸 שלב העברת 90% החל', ownership_order: '📄 הוזמן צו העברת בעלות',
      licensing: '🏢 בטיפול אישורי משרד הרישוי', released: '🚚 הרכב משוחרר — בדרך אליך!',
    };
      const msg = `שלום ${name},\nעדכון מכרז — ${auction?.car_title}:\n${statusMsg[status] || status}${finalPrice ? `\nמחיר סופי: ₪${Number(finalPrice).toLocaleString()}` : ''}\n\nדרסו — בית ליווי מקצועי למכרזים`;
      await sendWhatsApp(phone, msg);
    }
  }

  revalidatePath('/admin/auctions');
  redirect('/admin/auctions?ok=' + encodeURIComponent('הסטטוס עודכן ✓'));
}

async function deleteAuction(formData) {
  'use server';
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('auctions').delete().eq('id', formData.get('id'));
  if (error) redirect('/admin/auctions?err=' + encodeURIComponent('מחיקת המכרז נכשלה'));
  revalidatePath('/admin/auctions');
  redirect('/admin/auctions?ok=' + encodeURIComponent('המכרז נמחק ✓'));
}

export default async function AuctionsPage() {
  const { supabase } = await requireAdmin();

  const { data: auctions } = await supabase
    .from('auctions')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false });

  const { data: clients } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'client')
    .order('full_name');

  const all = auctions || [];
  const active = all.filter(a => ['submitted', 'under_review', 'pending_release', 'transfer10', 'redemption', 'transfer90', 'ownership_order', 'licensing'].includes(a.status));
  const won = all.filter(a => ['won', 'released', 'transfer10', 'redemption', 'transfer90', 'ownership_order', 'licensing'].includes(a.status));
  const lost = all.filter(a => a.status === 'lost');
  const totalBids = active.reduce((s, a) => s + (Number(a.max_bid) || 0), 0);
  const winRate = all.length > 0 ? Math.round((won.length / (won.length + lost.length || 1)) * 100) : 0;

  const statusLabel = {
    transfer10: 'העברת 10%',
    redemption: 'זכות פידיון',
    transfer90: 'העברת 90%',
    ownership_order: 'הזמנת צו העברת בעלות',
    licensing: 'אישורי משרד הרישוי',
    released: 'משוחרר — בדרך אליך',
    submitted: 'הצעה הוגשה',
    under_review: 'בבדיקת כונס',
    won: 'זכייה',
    lost: 'לא זכה',
    cancelled: 'בוטל',
    pending_release: 'ממתין לשחרור',
  };

  const statusClass = {
    transfer10: 'in_progress',
    redemption: 'awaiting_payment',
    transfer90: 'in_progress',
    ownership_order: 'awaiting_payment',
    licensing: 'in_progress',
    released: 'paid',
    submitted: 'in_progress',
    under_review: 'awaiting_payment',
    won: 'paid',
    lost: 'cancelled',
    cancelled: 'cancelled',
    pending_release: 'in_progress',
  };

  return (
    <Shell active="auctions">
      <div className="page-title">מעקב מכרזים</div>
      <div className="page-sub">מבט כולל על הצעות פעילות, סטטוס זכיות והיסטוריית מכרזים</div>

      {/* Stats Row */}
      <div className="grid cols-4" style={{ marginBottom: 20 }}>
        <div className="card stat">
          <div className="num">{all.length}</div>
          <div className="label">סה״כ מכרזים</div>
        </div>
        <div className="card stat">
          <div className="num">{active.length}</div>
          <div className="label">פעילים</div>
        </div>
        <div className="card stat">
          <div className="num" style={{ color: 'var(--success)' }}>{winRate}%</div>
          <div className="label">אחוז זכייה</div>
        </div>
        <div className="card stat">
          <div className="num">₪{totalBids.toLocaleString()}</div>
          <div className="label">הון רתוק</div>
        </div>
      </div>

      <div className="admin-desktop-layout">
        {/* RIGHT: Auctions Table */}
        <div className="admin-col-right">
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0 }}>מכרזים פעילים והיסטוריית הצעות</h3>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>רכב / מכרז</th>
                    <th>לקוח</th>
                    <th>הצעה מקס׳</th>
                    <th>סגירה</th>
                    <th>סטטוס</th>
                    <th>עדכון</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {!all.length && (
                    <tr><td colSpan={7}><div className="empty">אין מכרזים עדיין</div></td></tr>
                  )}
                  {all.map((a) => (
                    <tr key={a.id} style={a.status === 'lost' ? { opacity: 0.6 } : undefined}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13, textDecoration: a.status === 'lost' ? 'line-through' : 'none' }}>
                          {a.car_title}
                        </div>
                        {(a.auction_source || a.case_number) && (
                          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                            {[a.auction_source, a.case_number].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </td>
                      <td>{a.profiles?.full_name || '—'}</td>
                      <td style={{ fontWeight: 600 }}>
                        ₪{Number(((a.status === 'won' || a.status === 'released') && a.final_price) ? a.final_price : (a.max_bid || 0)).toLocaleString()}
                        {(a.status === 'won' || a.status === 'released') && a.final_price ? <div style={{ fontSize: 10.5, color: 'var(--success)' }}>מחיר זכייה</div> : null}
                      </td>
                      <td className="muted">
                        {a.closing_date ? new Date(a.closing_date).toLocaleDateString('he-IL') : '—'}
                        {a.closing_date && (
                          <div style={{ fontSize: 11, color: a.status === 'won' ? 'var(--success)' : 'var(--muted-dim)' }}>
                            {(() => { const d = Math.floor((Date.now() - new Date(a.closing_date)) / 86400000); return d === 0 ? 'היום' : d > 0 ? `לפני ${d} ימים` : `בעוד ${-d} ימים`; })()}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${statusClass[a.status] || ''}`}>
                          {statusLabel[a.status] || a.status}
                        </span>
                      </td>
                      <td>
                        <form action={updateAuctionStatus} className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                          <input type="hidden" name="auction_id" value={a.id} />
                          <AutoSubmitSelect name="status" defaultValue={a.status} style={{ width: 170 }}>
                            {!STAGE_OPTIONS.some(([v]) => v === a.status) && (
                              <option value={a.status} disabled>{statusLabel[a.status] || a.status}</option>
                            )}
                            {STAGE_OPTIONS.map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                            <option value="lost">לא זכה</option>
                            <option value="cancelled">בוטל</option>
                          </AutoSubmitSelect>
                        </form>
                      </td>
                      <td>
                        <form action={deleteAuction}>
                          <input type="hidden" name="id" value={a.id} />
                          <DeleteButton title="מחיקת מכרז" />
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* LEFT: Add Auction Form */}
        <div className="admin-col-left">
          <div className="card">
            <h3>🏆 הוספת זכייה לפי קישור</h3>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
              מדביקים קישור BidSpirit — הפרטים של הרכב נמשכים אוטומטית והזכייה נרשמת בהיסטוריה.
            </p>
            <form action={addWinByLink}>
              <div className="field">
                <label>קישור למכרז (BidSpirit)</label>
                <input name="link" dir="ltr" required placeholder="https://cars.bidspirit.com/ui/lotPage/..." />
              </div>
              <div className="grid cols-2">
                <div className="field">
                  <label>תאריך המכרז</label>
                  <input name="auction_date" type="date" />
                </div>
                <div className="field">
                  <label>מחיר זכייה (₪, אופציונלי)</label>
                  <input name="final_price" type="number" dir="ltr" placeholder="98,000" />
                </div>
              </div>
              <div className="field">
                <label>לקוח (אופציונלי)</label>
                <select name="client_id" defaultValue="">
                  <option value="">— ללא לקוח —</option>
                  {(clients || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>
              <SubmitButton className="btn" style={{ width: '100%' }}>🏆 רישום הזכייה</SubmitButton>
            </form>
          </div>

          {/* Quick Stats */}
          <div className="card">
            <h3>סיכום רבעוני — זכיות</h3>
            <div className="grid cols-2" style={{ gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'var(--surface-lowest)', padding: 14, borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{won.length}</div>
                <div className="muted" style={{ fontSize: 11 }}>רכבים שנרכשו</div>
              </div>
              <div style={{ background: 'var(--surface-lowest)', padding: 14, borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--primary)' }}>{winRate}%</div>
                <div className="muted" style={{ fontSize: 11 }}>אחוז זכייה</div>
              </div>
            </div>
            {/* Win rate bar */}
            <div style={{ height: 6, background: 'var(--surface-highest)', borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
              <div style={{ height: '100%', background: 'var(--primary)', width: `${winRate}%` }} />
            </div>
            <div className="row between" style={{ marginTop: 4 }}>
              <span className="muted" style={{ fontSize: 10, color: 'var(--primary)' }}>זכיות</span>
              <span className="muted" style={{ fontSize: 10 }}>הפסדים</span>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
