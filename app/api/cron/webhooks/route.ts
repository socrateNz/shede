import { NextResponse, type NextRequest } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';
import { processDueWebhooks } from '@/lib/api/webhooks';

// Relance des webhooks en attente. À appeler chaque minute avec l'en-tête
// `Authorization: Bearer <CRON_SECRET>` : sur Vercel gratuit, c'est Supabase
// (pg_cron + pg_net) qui s'en charge — voir docs/phase13-api.sql, section 14.

const KEEP_DELIVERED_DAYS = 30;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await processDueWebhooks({ limit: 100 });

  // Ménage : les envois réussis de plus de 30 jours ne servent plus.
  const cutoff = new Date(Date.now() - KEEP_DELIVERED_DAYS * 24 * 3600_000).toISOString();
  await getAdminSupabase().from('webhook_deliveries').delete().eq('status', 'DELIVERED').lt('created_at', cutoff);

  return NextResponse.json(result);
}

export const POST = GET;
