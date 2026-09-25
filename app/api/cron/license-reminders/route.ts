import { NextResponse, type NextRequest } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';
import { sendMail } from '@/lib/mail';
import { buildLicenseExpiringMails, getOrganizationAdminRecipients } from '@/lib/emails';

// Rappels d'expiration de licence / d'essai, à J-7 et J-1.
// À appeler une fois par jour (voir vercel.json) avec l'en-tête
// `Authorization: Bearer <CRON_SECRET>` — c'est ce qu'envoie Vercel Cron.
// Chaque licence ne tombe dans une fenêtre [J+N, J+N+1[ qu'un seul jour :
// avec un appel quotidien, chaque rappel part une seule fois.

const REMINDER_DAYS = [7, 1];

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getAdminSupabase();
  const report: { organizationId: string; daysLeft: number; sent: boolean }[] = [];

  for (const daysLeft of REMINDER_DAYS) {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() + daysLeft);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);

    const { data: licenses, error } = await admin
      .from('licenses')
      .select('organization_id, plan, expires_at, organizations(name)')
      .eq('is_active', true)
      .not('organization_id', 'is', null)
      .gte('expires_at', from.toISOString())
      .lt('expires_at', to.toISOString());

    if (error) {
      console.error('[cron license-reminders] error:', error.message);
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    for (const license of licenses || []) {
      const recipients = await getOrganizationAdminRecipients(license.organization_id);
      const organization = Array.isArray(license.organizations) ? license.organizations[0] : license.organizations;
      const mails = buildLicenseExpiringMails({
        recipients,
        organizationName: organization?.name,
        expiresAt: license.expires_at,
        daysLeft,
        isTrial: license.plan === 'TRIAL',
      });
      const results = await Promise.all(mails.map((mail) => sendMail(mail)));
      report.push({
        organizationId: license.organization_id,
        daysLeft,
        sent: results.length > 0 && results.every((r) => r.ok),
      });
    }
  }

  return NextResponse.json({ ok: true, reminders: report });
}
