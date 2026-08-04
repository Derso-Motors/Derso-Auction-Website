import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { SubmitButton, DeleteButton } from '../../../components/SubmitButton';
import { timeAgo } from '../../../lib/utils';
import { sendWhatsApp } from '../../../lib/whatsapp';

export const dynamic = 'force-dynamic';

const AUCTION_STATUSES = ['submitted', 'under_review', 'won', 'lost', 'cancelled', 'pending_release'];

async function addAuction(formData) {
  'use server';
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/');

  const clientId = formData.get('client_id');
  const row = {
    client_id: clientId || null,
    car_title: formData.get('car_title'),
    auction_source: formData.get('auction_source') || null,
    case_number: formData.get('case_number') || null,
    max_bid: Number(formData.get('max_bid')) || 0,
    closing_date: formData.get('closing_date') || null,
    status: 'submitted',
  };
  const { error } = await supabase.from('auctions').insert(row);
  if (error) redirect('/admin/auctions?err=' + encodeURIComponent('הוספת המכרז נכשלה'));
  revalidatePath('/admin/auctions');
  redirect('/admin/auctions?ok=' + encodeURIComponent('המכרז נוסף ✓'));
}

async function updateAuctionStatus(formData) {
  'use server';
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/');
  const status = formData.get('status');
  if (!AUCTION_STATUSES.includes(status)) redirect('/admin/auctions?err=' + encodeURIComponent('סטטוס לא תקין'));
  const patch = { status };
  const finalPrice = formData.get('final_price');
  if (finalPrice) patch.final_price = Number(finalPrice);
  const auctionId = formData.get('auction_id');
  const { error } = await supabase.from('auctions').update(patch).eq('id', auctionId);
  if (error) redirect('/admin/auctions?err=' + encodeURIComponent('עדכון הסטטוס נכשל'));

  if (['won', 'lost', 'pending_release'].includes(status)) {
    const { data: auction } = await supabase.from('auctions').select('car_title, client_id, profiles(full_name, phone)').eq('id', auctionId).single();
    const phone = auction?.profiles?.phone;
    const name = auction?.profiles?.full_name || '';
    if (phone) {
      const statusMsg = { won: '🎉 זכית', lost: '❌ לא זכית', pending_release: '⏳ ממתין לשחרור' };
      const msg = `שלום ${name},\nעדכון מכרז — ${auction?.car_title}:\n${statusMsg[status] || status}${finalPrice ? `\nמחיר סופי: ₪${Number(finalPrice).toLocaleString()}` : ''}\n\nדרסו — בית ליווי מקצועי למכרזים`;
      await sendWhatsApp(phone, msg);
    }
  }

  revalidatePath('/admin/auctions');
  redirect('/admin/auctions?ok=' + encodeURIComponent('הסטטוס עודכן ✓'));
}

async function deleteAuction(formData) {
  'use server';
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/');
  const { error } = await supabase.from('auctions').delete().eq('id', formData.get('id'));
  if (error) redirect('/admin/auctions?err=' + encodeURIComponent('מחיקת המכרז נכשלה'));
  revalidatePath('/admin/auctions');
  redirect('/admin/auctions?ok=' + encodeURIComponent('המכרז נמחק ✓'));
}

export default async function AuctionsPage() {
  const { supabase, user } = await requireUser();
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') redirect('/');

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
  const active = all.filter(a => ['submitted', 'under_review', 'pending_release'].includes(a.status));
  const won = all.filter(a => a.status === 'won');
  const lost = all.filter(a => a.status === 'lost');
  const totalBids = active.reduce((s, a) => s + (Number(a.max_bid) || 0), 0);
  const winRate = all.length > 0 ? Math.round((won.length / (won.length + lost.length || 1)) * 100) : 0;

  const statusLabel = {
    submitted: 'הצעה הוגשה',
    under_review: 'בבדיקת כונס',
    won: 'זכייה',
    lost: 'לא זכה',
    cancelled: 'בוטל',
    pending_release: 'ממתין לשחרור',
  };

  const statusClass = {
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
                      <td style={{ fontWeight: 600 }}>₪{Number(a.max_bid || 0).toLocaleString()}</td>
                      <td className="muted">
                        {a.closing_date ? new Date(a.closing_date).toLocaleDateString('he-IL') : '—'}
                      </td>
                      <td>
                        <span className={`badge ${statusClass[a.status] || ''}`}>
                          {statusLabel[a.status] || a.status}
                        </span>
                      </td>
                      <td>
                        <form action={updateAuctionStatus} className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                          <input type="hidden" name="auction_id" value={a.id} />
                          <select name="status" defaultValue={a.status} style={{ width: 130 }}>
                            <option value="submitted">הצעה הוגשה</option>
                            <option value="under_review">בבדיקת כונס</option>
                            <option value="won">זכייה</option>
                            <option value="pending_release">ממתין לשחרור</option>
                            <option value="lost">לא זכה</option>
                            <option value="cancelled">בוטל</option>
                          </select>
                          <input name="final_price" placeholder="מחיר סופי" type="number" dir="ltr" style={{ width: 100 }} />
                          <SubmitButton className="btn small secondary">עדכון</SubmitButton>
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
            <h3>הוספת מכרז חדש</h3>
            <form action={addAuction}>
              <div className="field">
                <label>שם רכב / תיאור</label>
                <input name="car_title" required placeholder="Toyota Land Cruiser 2022" />
              </div>
              <div className="field">
                <label>לקוח</label>
                <select name="client_id">
                  <option value="">— ללא —</option>
                  {(clients || []).map(c => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid cols-2">
                <div className="field">
                  <label>מקור מכרז</label>
                  <input name="auction_source" placeholder='הוצל"פ / כונס / ליסינג' />
                </div>
                <div className="field">
                  <label>מס׳ תיק</label>
                  <input name="case_number" placeholder="#99281-A" dir="ltr" />
                </div>
              </div>
              <div className="grid cols-2">
                <div className="field">
                  <label>הצעה מקסימלית (₪)</label>
                  <input name="max_bid" type="number" dir="ltr" required placeholder="245000" />
                </div>
                <div className="field">
                  <label>תאריך סגירה</label>
                  <input name="closing_date" type="date" dir="ltr" />
                </div>
              </div>
              <SubmitButton className="btn" style={{ width: '100%', marginTop: 8 }}>הוסף מכרז</SubmitButton>
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
