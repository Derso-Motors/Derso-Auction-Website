import Shell from '../../../components/Shell';
import { requireAdmin } from '../../../lib/supabase-server';
import InventoryClient from './InventoryClient';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const { supabase } = await requireAdmin();

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
