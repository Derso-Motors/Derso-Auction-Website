import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import InventoryClient from './InventoryClient';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/');

  const { data: cars } = await supabase
    .from('inventory_cars')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <Shell active="inventory">
      <InventoryClient initialCars={cars || []} />
    </Shell>
  );
}
