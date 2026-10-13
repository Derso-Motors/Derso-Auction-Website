import Link from 'next/link';
import Shell from '../../../../components/Shell';
import { requireAdmin } from '../../../../lib/supabase-server';
import { loadSocialHub } from '../../../../lib/social-hub';
import AccountsHub from './AccountsHub';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function SocialAccountsPage() {
  await requireAdmin();
  const hub = await loadSocialHub();

  return (
    <Shell active="social-accounts">
      <div className="page-title">חשבונות סושיאל</div>
      <div className="page-sub">
        כל החשבונות שמחוברים ל-Socialync. לחיצה על חשבון פותחת את הנתונים שלו. · <Link href="/admin/social" style={{ textDecoration: 'underline' }}>לפוסטים ולפרסום</Link>
      </div>

      {hub.error === 'missing_key' && (
        <div className="error-msg">חסר SOCIALYNC_API_KEY בהגדרות של הפרויקט ב-Vercel, אז אי אפשר למשוך את החשבונות.</div>
      )}
      {hub.error && hub.error !== 'missing_key' && (
        <div className="error-msg">
          החיבור ל-Socialync נכשל: {hub.error}. אם המפתח הוחלף לאחרונה, צריך לעדכן את SOCIALYNC_API_KEY בפרויקט הזה ב-Vercel.
        </div>
      )}

      {!hub.error && <AccountsHub accounts={hub.accounts} />}

      <details className="card hub-diag">
        <summary>מה Socialync מחזיר (לבדיקה)</summary>
        {hub.tools?.length > 0 && (
          <>
            <h3>כלים זמינים ב-API ({hub.tools.length})</h3>
            <table className="data">
              <tbody>
                {hub.tools.map((t) => (
                  <tr key={t.name}>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.name}</td>
                    <td style={{ fontFamily: 'inherit' }}>{t.description}</td>
                    <td className="muted">{t.params.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <h3 style={{ marginTop: 20 }}>תשובות גולמיות</h3>
        <pre className="hub-pre">{JSON.stringify(hub.raw, null, 2)}</pre>
      </details>
    </Shell>
  );
}
