import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import Shell from '../../components/Shell';
import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <Shell active="settings">
      <h1 className="page-title">הגדרות חשבון</h1>
      <p className="page-sub">עדכון פרטים אישיים וסיסמה</p>
      <SettingsForm
        email={user.email}
        fullName={profile?.full_name || ''}
        phone={profile?.phone || ''}
        credits={profile?.credits || 0}
        createdAt={profile?.created_at}
      />
    </Shell>
  );
}
