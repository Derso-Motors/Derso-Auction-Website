import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import InventoryClient from './InventoryClient';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/');

  const [{ data: cars }, { data: clients }] = await Promise.all([
    supabase.from('inventory_cars').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, phone').eq('role', 'client').order('full_name'),
  ]);

  return (
    <Shell active="inventory">
      <InventoryClient initialCars={cars || []} clients={clients || []} />
    </Shell>
  );
}
