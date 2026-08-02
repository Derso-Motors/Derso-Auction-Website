import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { notFound } from 'next/navigation';
import CarLive from './live';

export const dynamic = 'force-dynamic';

export default async function CarPage({ params }) {
  const { supabase, user } = await requireUser();
  const [{ data: car }, { data: profile }] = await Promise.all([
    supabase.from('cars').select('*, car_stages(*), car_updates(*)').eq('id', params.id).single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ]);

  if (!car) notFound();
  // Only the owning client or an admin may view a car
  if (profile?.role !== 'admin' && car.client_id !== user.id) notFound();

  const stages = (car.car_stages || []).sort((a, b) => a.step_number - b.step_number);
  const updates = (car.car_updates || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <Shell active="home">
      <div className="page-title">{car.title}</div>
      <div className="page-sub">
        {car.year ? `שנתון ${car.year}` : ''}{car.km ? ` · ${Number(car.km).toLocaleString()} ק"מ` : ''}
        {car.license_plate ? ` · לוחית ${car.license_plate}` : ''}
        {car.won_price ? ` · נרכש ב-₪${Number(car.won_price).toLocaleString()}` : ''}
      </div>

      {car.image_url && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <img src={car.image_url} alt={car.title} style={{ width: '100%', maxHeight: 340, objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      <CarLive carId={car.id} initialStages={stages} initialUpdates={updates} />

      {car.auction_link && (
        <div className="card">
          <a href={car.auction_link} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 14 }}>
            צפייה בעמוד המכרז המקורי
          </a>
        </div>
      )}
    </Shell>
  );
}
