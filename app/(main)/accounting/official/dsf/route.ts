import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { getAccountingData } from '@/app/actions/accounting';
import { getFiscalYears } from '@/app/actions/closing';
import { getSession } from '@/lib/auth';
import { buildDsf, type DsfIdentity } from '@/lib/accounting/dsf';
import { accountingDate } from '@/lib/accounting/posting';
import { dayBefore } from '@/lib/accounting/syscohada';
import { getAdminSupabase } from '@/lib/supabase';
import { fillTemplate } from '@/lib/xlsx-template';

// DSF au format Excel de la DGI (système normal), remplie pour l'exercice choisi :
// mêmes paramètres et mêmes calculs que la page « États financiers ».
const TEMPLATE = join(process.cwd(), 'templates', 'dsf', 'dsf-systeme-normal.xlsx');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function shiftYear(date: string, years: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let from = params.get('from');
  let to = params.get('to');
  const period = params.get('period');
  if (period && /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/.test(period)) [from, to] = period.split('_');

  const years = await getFiscalYears().catch(() => null);
  const year = accountingDate().slice(0, 4);
  const start = from && DATE_RE.test(from) ? from : years?.current.start ?? `${year}-01-01`;
  const end = to && DATE_RE.test(to) && to >= start ? to : years?.current.end ?? `${year}-12-31`;

  const data = await getAccountingData({ point: params.get('point'), from: start, to: end });
  if (!data) return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
  const { lines, scope } = data;

  // Entité déclarante : le point (choisi, ou celui de l'utilisateur), sinon l'organisation
  const admin = getAdminSupabase();
  const pointId = scope.pointId ?? scope.structureId;
  let identity: DsfIdentity | null = null;
  if (pointId) {
    const { data: s } = await admin.from('structures').select('name, niu, rccm, address, city, phone, email').eq('id', pointId).maybeSingle();
    identity = s;
  } else {
    const session = await getSession();
    if (session?.organizationId) {
      const { data: o } = await admin.from('organizations').select('name, phone, email, city').eq('id', session.organizationId).maybeSingle();
      identity = o;
    }
  }
  if (!identity) return NextResponse.json({ error: 'entity not found' }, { status: 404 });

  const dsf = buildDsf({ identity, lines, from: start, to: end, previousFrom: shiftYear(start, -1), previousTo: dayBefore(start) });
  const file = fillTemplate(new Uint8Array(await readFile(TEMPLATE)), dsf.edits, dsf.sharedText);

  const slug = identity.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fileName = `DSF-${slug || 'entite'}-${end.slice(0, 4)}.xlsx`;
  return new Response(file, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
