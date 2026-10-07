import { NextResponse, type NextRequest } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';
import { computeForecast } from '@/lib/forecast-server';

// Calcul quotidien des prévisions de tous les points qui ont le module PREVISIONS,
// pour que la prévision du jour soit conservée avant l'ouverture (mesure de la
// fiabilité), même si personne n'ouvre l'écran. À appeler une fois par nuit
// (vers 4 h, heure du Cameroun) avec `Authorization: Bearer <CRON_SECRET>` :
// voir docs/phase19-forecasts.sql, section 4.

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: points } = await getAdminSupabase().from('structures').select('id, modules').contains('modules', ['PREVISIONS']);
  let computed = 0;
  let failed = 0;
  for (const point of points || []) {
    try {
      await computeForecast(point.id as string);
      computed++;
    } catch (error) {
      failed++;
      console.error('[prévisions] point', point.id, (error as Error).message);
    }
  }
  return NextResponse.json({ computed, failed });
}

export const POST = GET;
