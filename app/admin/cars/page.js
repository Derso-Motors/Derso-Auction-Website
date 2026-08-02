import { DeleteButton } from '../../../components/SubmitButton';
import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { timeAgo } from '../../../lib/utils';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const STAGES = ['זכייה במכרז', 'תשלום למכרז', 'שחרור הרכב', 'העברת בעלות', 'שינוע הרכב', 'מסירה ללקוח'];

async function deleteCar(formData) {
  'use server';
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/');
  const id = formData.get('id');
  await supabase.from('car_updates').delete().eq('car_id', id);
  await supabase.from('car_stages').delete().eq('car_id', id);
  await supabase.from('cars').delete().eq('id', id);
  revalidatePath('/admin/cars');
}

export default async function CarsListPage() {
  const { supabase, user } = await requireUser();
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') redirect('/');

  const { data: cars } = await supabase
    .from('cars')
    .select('*, car_stages(*), profiles(full_name), client_name, client_phone')
    .order('created_at', { ascending: false });

  return (
    <Shell active="admin">
      <div className="page-title">כל הרכבים</div>
      <div className="page-sub">רכבים בטיפול ורכבים שהושלמו</div>
      <div className="card">
        {!cars?.length && <div className="empty">אין רכבים</div>}
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>רכב</th><th>לקוח</th><th>שלב נוכחי</th><th>התקדמות</th><th>נוצר</th><th></th><th></th></tr></thead>
            <tbody>
              {cars?.map((car) => {
                const stages = (car.car_stages || []).sort((a, b) => a.step_number - b.step_number);
                const done = stages.filter((s) => s.status === 'done').length;
                const current = stages.find((s) => s.status === 'in_progress');
                const clientLabel = car.profiles?.full_name || car.client_name || 'ללא לקוח';
                return (
                  <tr key={car.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{car.title}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>
                        {car.year ? `${car.year}` : ''}{car.license_plate ? ` · ${car.license_plate}` : ''}
                      </div>
                    </td>
                    <td>{clientLabel}{car.client_phone ? <span className="muted"> ({car.client_phone})</span> : ''}</td>
                    <td><span className={`badge ${done >= 6 ? 'done' : 'in_progress'}`}>{done >= 6 ? 'הושלם' : current ? current.title : STAGES[done] || 'בתהליך'}</span></td>
                    <td>{done}/6</td>
                    <td className="muted">{timeAgo(car.created_at)}</td>
                    <td><Link href={`/cars/${car.id}`} style={{ color: 'var(--accent)', fontSize: 12.5 }}>צפייה</Link></td>
                    <td>
                      <form action={deleteCar}>
                        <input type="hidden" name="id" value={car.id} />
                        <DeleteButton title="מחיקת רכב" />
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
