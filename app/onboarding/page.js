import { requireUser } from '../../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import OnboardingForm from './OnboardingForm';

export const dynamic = 'force-dynamic';

async function saveOnboarding(formData) {
  'use server';
  const { supabase, user } = await requireUser();
  const P = '/onboarding';

  const bidspirit = String(formData.get('bidspirit') || '').trim();
  const city = String(formData.get('city') || '').trim();
  const street = String(formData.get('street') || '').trim();
  const nationalId = String(formData.get('national_id') || '').replace(/\D/g, '');
  const cardHolder = String(formData.get('card_holder') || '').trim();
  const cardNumber = String(formData.get('card_number') || '').replace(/\D/g, '');
  const cardExpiry = String(formData.get('card_expiry') || '').trim();

  if (!bidspirit) redirect(P + '?err=' + encodeURIComponent('חסר שם המשתמש בבידספיריט'));
  if (!city || !street) redirect(P + '?err=' + encodeURIComponent('חסרה כתובת מלאה (עיר ורחוב)'));
  if (nationalId.length !== 9) redirect(P + '?err=' + encodeURIComponent('תעודת זהות חייבת להכיל 9 ספרות'));
  if (!cardHolder) redirect(P + '?err=' + encodeURIComponent('חסר שם בעל הכרטיס'));
  if (cardNumber.length < 12 || cardNumber.length > 19) redirect(P + '?err=' + encodeURIComponent('מספר הכרטיס לא תקין'));
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry)) redirect(P + '?err=' + encodeURIComponent('תוקף הכרטיס חייב להיות בפורמט MM/YY, למשל 08/28'));

  // Only the last 4 digits are stored — full card numbers never touch our DB.
  const { error } = await supabase.from('client_billing').upsert({
    user_id: user.id,
    bidspirit_username: bidspirit,
    address_city: city,
    address_street: street,
    national_id: nationalId,
    card_holder: cardHolder,
    card_last4: cardNumber.slice(-4),
    card_expiry: cardExpiry,
    updated_at: new Date().toISOString(),
  });
  if (error) redirect(P + '?err=' + encodeURIComponent('שמירת הפרטים נכשלה — נסה שוב'));

  await supabase.from('profiles').update({ onboarded: true }).eq('id', user.id);
  revalidatePath('/');
  redirect('/?ok=' + encodeURIComponent('הפרטים נשמרו והחשבון שלך מוכן! 🎉'));
}

export default async function OnboardingPage({ searchParams }) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles')
    .select('role, full_name, phone_verified, onboarded').eq('id', user.id).single();

  if (profile?.role === 'admin' || profile?.onboarded) redirect('/');
  if (!profile?.phone_verified) redirect('/verify-phone');

  const { data: existing } = await supabase.from('client_billing').select('*').eq('user_id', user.id).single();

  return (
    <OnboardingForm
      action={saveOnboarding}
      fullName={profile?.full_name || ''}
      existing={existing || {}}
      err={searchParams?.err || ''}
    />
  );
}
