import Link from 'next/link';
import { headers } from 'next/headers';
import { ArrowLeft, ChevronRight, KeyRound, Plug, ShieldCheck } from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { getLocale } from '@/lib/i18n/server';
import { API_DOCS_CONTENT, type ApiDocsContent } from './content';
import { CopyButton } from './copy-button';
import { TryItButton, TryItProvider } from './try-it';

export async function generateMetadata() {
  const c = API_DOCS_CONTENT[await getLocale()];
  return { title: c.meta.title, description: c.meta.description };
}

/** Adresse publique du site (pour les exemples) : APP_URL, sinon l'hôte de la requête. */
async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'shede.example';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

// ── Exemples (identiques dans toutes les langues) ─────────

const json = (value: unknown) => JSON.stringify(value, null, 2);

const examples = (api: string) => ({
  auth: 'Authorization: Bearer shd_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  success: json({ data: { '…': '…' } }),
  error: json({ error: { code: 'validation_error', message: '…', details: [{ field: 'items.0.product_id', code: 'product_unavailable' }] } }),
  point: `curl ${api}/point \\\n  -H "Authorization: Bearer $SHEDE_KEY"`,
  pointResponse: json({
    data: {
      id: '3f9d78e3-…', livemode: true, name: 'Restaurant Le Wouri', type: 'RESTAURANT', phone: '+237671234567',
      address: 'Rue Joss', city: 'Douala', country: 'Cameroun', currency: 'XAF',
      tax: { rate: 19.25, prices_include_tax: true }, takeaway_fee: 200, logo_url: null,
    },
  }),
  menu: `curl ${api}/menu \\\n  -H "Authorization: Bearer $SHEDE_KEY"`,
  menuResponse: json({
    data: [
      {
        id: '9b1e…', name: 'Poulet DG', description: '…', category: 'Plats', image_url: 'https://…',
        price: 4500, price_with_tax: 4500, is_available: true,
        accompaniments: [{ id: 'a71c…', name: 'Plantains mûrs', price: 0, price_with_tax: 0, max_quantity: 1, is_available: true }],
      },
    ],
  }),
  createOrder: `curl -X POST ${api}/orders \\
  -H "Authorization: Bearer $SHEDE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${json({
    external_id: 'GLV-48213',
    partner: 'glovo',
    customer: { name: 'Aïcha N.', phone: '699123456' },
    items: [{ product_id: '9b1e…', quantity: 2, notes: 'Bien pimenté', accompaniments: [{ id: 'a71c…', quantity: 1 }] }],
    notes: 'Sonner au portail',
    delivery_address: 'Bonamoussadi, face Total',
  })}'`,
  order: json({
    data: {
      id: 'c42f…', livemode: true, external_id: 'GLV-48213', partner: 'glovo', status: 'accepted',
      created_at: '2026-10-01T12:15:00.000Z', updated_at: '2026-10-01T12:16:10.000Z',
      accepted_at: '2026-10-01T12:16:10.000Z', prep_minutes: 20, estimated_ready_at: '2026-10-01T12:36:10.000Z',
      rejection_reason: null, cancel_reason: null, invoice_number: null,
      customer: { name: 'Aïcha N.', phone: '+237699123456' }, notes: 'Sonner au portail',
      items: [{
        id: 'e10a…', product_id: '9b1e…', name: 'Poulet DG', quantity: 2, unit_price: 4500, total_price: 9000, notes: 'Bien pimenté',
        accompaniments: [{ id: 'a71c…', name: 'Plantains mûrs', quantity: 2, unit_price: 0, total_price: 0 }],
      }],
      amounts: { currency: 'XAF', subtotal: 9000, discount: 0, tax: 1453, total: 9000 },
      courier: { status: null, name: null, phone: null },
    },
  }),
  getOrder: `curl ${api}/orders/GLV-48213 \\\n  -H "Authorization: Bearer $SHEDE_KEY"`,
  listOrders: `curl "${api}/orders?updated_since=2026-10-01T12:00:00Z&limit=50" \\\n  -H "Authorization: Bearer $SHEDE_KEY"`,
  cancel: `curl -X POST ${api}/orders/GLV-48213/cancel \\
  -H "Authorization: Bearer $SHEDE_KEY" -H "Content-Type: application/json" \\
  -d '{ "reason": "Client injoignable" }'`,
  delivery: `curl -X POST ${api}/orders/GLV-48213/delivery-events \\
  -H "Authorization: Bearer $SHEDE_KEY" -H "Content-Type: application/json" \\
  -d '{ "status": "PICKED_UP", "courier_name": "Paul", "courier_phone": "677000000" }'`,
  webhookRequest: `POST https://votre-serveur/webhooks/shede
Content-Type: application/json
Shede-Event: order.status_changed
Shede-Delivery: 6f1c…
Shede-Signature: t=1759312345,v1=5d41402abc4b2a76b9719d911017c592…

${json({ id: '6f1c…', type: 'order.status_changed', created_at: '2026-10-01T12:16:10.000Z', livemode: true, data: { previous_status: 'pending_acceptance', order: { '…': '…' } } })}`,
  testKey: 'Authorization: Bearer shd_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  testWebhook: `curl -X POST ${api}/sandbox/webhooks \\
  -H "Authorization: Bearer $SHEDE_TEST_KEY" -H "Content-Type: application/json" \\
  -d '{ "type": "order.status_changed", "order_id": "test_…", "status": "ready" }'`,
  testWebhookResponse: json({ data: { configured: true, id: 'evt_test_…', delivered: true, status_code: 200, error: null } }),
  signature: `import { createHmac, timingSafeEqual } from 'crypto';

function verifyShedeSignature(secret, header, rawBody) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac('sha256', secret).update(\`\${t}.\${rawBody}\`).digest('hex');
  return expected.length === parts.v1.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}`,
  signaturePhp: `function verifyShedeSignature(string $secret, string $header, string $rawBody): bool {
    parse_str(str_replace(',', '&', $header), $parts);
    $t = (int) ($parts['t'] ?? 0);
    if (!$t || abs(time() - $t) > 300) return false;
    $expected = hash_hmac('sha256', $t . '.' . $rawBody, $secret);
    return hash_equals($expected, $parts['v1'] ?? '');
}`,
});

const VALIDATION_CODES = [
  'product_not_found',
  'product_unavailable',
  'accompaniment_not_offered',
  'accompaniment_unavailable',
  'accompaniment_quantity_exceeded',
];

// ── Mise en page ─────────────────────────────────────────

function Code({ code, language, c }: { code: string; language: string; c: ApiDocsContent }) {
  return (
    <div className="relative my-4 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-2">
        <span className="font-mono text-xs text-slate-400">{language}</span>
        <CopyButton text={code} label={c.header.copy} copiedLabel={c.header.copied} />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-slate-300">{code}</pre>
    </div>
  );
}

function Endpoint({ method, path, tryId, c }: { method: 'GET' | 'POST'; path: string; tryId?: string; c?: ApiDocsContent }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <p className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-sm shadow-sm">
        <span className={method === 'GET' ? 'font-bold text-emerald-600' : 'font-bold text-purple-600'}>{method}</span>
        <span className="text-slate-800">/api/v1{path}</span>
      </p>
      {tryId && c && <TryItButton endpointId={tryId} label={c.tryIt.open} />}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-16 scroll-mt-24">
      <h2 className="mb-3 text-2xl font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left font-semibold text-slate-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={j === 0 || (j === 1 && head.length > 2) ? 'px-4 py-2.5 align-top font-mono text-xs text-slate-800' : 'px-4 py-2.5 align-top text-slate-600'}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ApiDocsPage() {
  const locale = await getLocale();
  const c = API_DOCS_CONTENT[locale];
  const api = `${await baseUrl()}/api/v1`;
  const ex = examples(api);

  const nav: { group: string; items: [string, string][] }[] = [
    { group: c.groups.start, items: [['intro', c.nav.intro], ['auth', c.nav.auth], ['responses', c.nav.responses], ['limits', c.nav.limits], ['test', c.nav.test]] },
    { group: c.groups.resources, items: [['point', c.nav.point], ['menu', c.nav.menu]] },
    {
      group: c.groups.orders,
      items: [
        ['lifecycle', c.nav.lifecycle],
        ['create-order', c.nav.createOrder],
        ['get-order', c.nav.getOrder],
        ['list-orders', c.nav.listOrders],
        ['cancel', c.nav.cancel],
        ['delivery', c.nav.delivery],
      ],
    },
    { group: c.groups.webhooks, items: [['webhooks', c.nav.webhooks], ['signature', c.nav.signature]] },
  ];

  return (
    <TryItProvider c={c} locale={locale}>
    <div className="flex min-h-screen flex-col bg-[#fdfdff]">
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-screen-xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.webp" alt="Shede" className="h-7 w-7 rounded-lg border-2 border-purple-600" />
              <span className="text-lg font-bold text-slate-900">Shede</span>
            </Link>
            <span className="hidden items-center gap-1 text-sm text-slate-400 sm:inline-flex">
              <ChevronRight className="h-4 w-4" />
              <Link href="/docs" className="hover:text-slate-700">{c.header.docs}</Link>
              <ChevronRight className="h-4 w-4" />
              <span className="font-medium text-purple-600">{c.header.api}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <TryItButton label={c.tryIt.open} variant="header" />
            <LanguageSwitcher tone="light" />
            <Link href="/docs" className="hidden items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 sm:inline-flex">
              <ArrowLeft className="h-4 w-4" /> {c.header.back}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-screen-xl flex-1 pt-16">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-slate-200 p-4 lg:block">
          {nav.map((section) => (
            <div key={section.group} className="mb-5">
              <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">{section.group}</p>
              {section.items.map(([id, label]) => (
                <a key={id} href={`#${id}`} className="block rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                  {label}
                </a>
              ))}
            </div>
          ))}
        </aside>

        <main className="min-w-0 flex-1 px-4 py-12 sm:px-10">
          <div className="mx-auto max-w-3xl">
            <Section id="intro" title={c.intro.title}>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-700">
                <Plug className="h-3.5 w-3.5" /> {c.intro.badge}
              </div>
              <p className="mb-6 text-lg leading-relaxed text-slate-500">{c.intro.text}</p>
              <p className="text-sm font-semibold text-slate-700">{c.intro.baseUrl}</p>
              <Code code={api} language="URL" c={c} />
              <ol className="space-y-2">
                {c.intro.flow.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-700">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </Section>

            <Section id="auth" title={c.auth.title}>
              <p className="text-slate-600">{c.auth.text}</p>
              <p className="mt-3 text-slate-600">{c.auth.header}</p>
              <Code code={ex.auth} language="HTTP" c={c} />
              <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0" /> {c.auth.warning}
              </p>
            </Section>

            <Section id="responses" title={c.responses.title}>
              <p className="text-slate-600">{c.responses.success}</p>
              <Code code={ex.success} language="JSON" c={c} />
              <p className="text-slate-600">{c.responses.error}</p>
              <Code code={ex.error} language="JSON" c={c} />
              <Table head={[c.responses.colHttp, c.responses.colCode, c.responses.colMeaning]} rows={c.responses.errors} />
              <p className="text-sm text-slate-600">{c.responses.amounts}</p>
            </Section>

            <Section id="limits" title={c.limits.title}>
              <p className="mb-3 text-slate-600">{c.limits.rate}</p>
              <p className="text-slate-600">{c.limits.quota}</p>
            </Section>

            <Section id="test" title={c.test.title}>
              <p className="text-slate-600">{c.test.text}</p>
              <Code code={ex.testKey} language="HTTP" c={c} />
              <ul className="mb-4 list-disc space-y-2 pl-5 text-slate-600">
                {c.test.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
              <h3 className="mt-6 font-semibold text-slate-800">{c.test.timelineTitle}</h3>
              <Table head={[c.test.colDelay, c.test.colStatus]} rows={c.test.timeline} />
              <p className="text-slate-600">{c.test.reject}</p>
              <h3 className="mt-6 font-semibold text-slate-800">{c.test.webhookTitle}</h3>
              <Endpoint method="POST" path="/sandbox/webhooks" tryId="sandbox-webhooks" c={c} />
              <p className="text-slate-600">{c.test.webhook}</p>
              <Code code={ex.testWebhook} language="bash" c={c} />
              <Code code={ex.testWebhookResponse} language="JSON" c={c} />
            </Section>

            <Section id="point" title={c.point.title}>
              <Endpoint method="GET" path="/point" tryId="point" c={c} />
              <p className="text-slate-600">{c.point.text}</p>
              <Code code={ex.point} language="bash" c={c} />
              <Code code={ex.pointResponse} language="JSON" c={c} />
            </Section>

            <Section id="menu" title={c.menu.title}>
              <Endpoint method="GET" path="/menu" tryId="menu" c={c} />
              <p className="text-slate-600">{c.menu.text}</p>
              <Code code={ex.menu} language="bash" c={c} />
              <Code code={ex.menuResponse} language="JSON" c={c} />
            </Section>

            <Section id="lifecycle" title={c.lifecycle.title}>
              <ul className="mb-4 list-disc space-y-2 pl-5 text-slate-600">
                {c.lifecycle.rules.map((rule) => <li key={rule}>{rule}</li>)}
              </ul>
              <Table head={[c.lifecycle.statuses, '']} rows={c.lifecycle.statusList} />
            </Section>

            <Section id="create-order" title={c.createOrder.title}>
              <Endpoint method="POST" path="/orders" tryId="create-order" c={c} />
              <Code code={ex.createOrder} language="bash" c={c} />
              <h3 className="mt-6 font-semibold text-slate-800">{c.createOrder.fields}</h3>
              <Table
                head={[c.createOrder.colField, c.createOrder.colRequired, c.createOrder.colDescription]}
                rows={c.createOrder.fieldList.map(([field, required, description]) => [
                  field,
                  required ? c.createOrder.yes : c.createOrder.no,
                  description,
                ])}
              />
              <p className="text-slate-600">{c.createOrder.response}</p>
              <p className="mt-3 flex gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> {c.createOrder.idempotency}
              </p>
              <p className="mt-4 text-sm text-slate-600">{c.createOrder.validation}</p>
              <p className="mt-2 flex flex-wrap gap-2">
                {VALIDATION_CODES.map((code) => (
                  <code key={code} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{code}</code>
                ))}
              </p>
            </Section>

            <Section id="get-order" title={c.getOrder.title}>
              <Endpoint method="GET" path="/orders/{id}" tryId="get-order" c={c} />
              <p className="text-slate-600">{c.getOrder.text}</p>
              <Code code={ex.getOrder} language="bash" c={c} />
              <Code code={ex.order} language="JSON" c={c} />
            </Section>

            <Section id="list-orders" title={c.listOrders.title}>
              <Endpoint method="GET" path="/orders?updated_since=…&limit=50" tryId="list-orders" c={c} />
              <p className="text-slate-600">{c.listOrders.text}</p>
              <Code code={ex.listOrders} language="bash" c={c} />
            </Section>

            <Section id="cancel" title={c.cancel.title}>
              <Endpoint method="POST" path="/orders/{id}/cancel" tryId="cancel" c={c} />
              <p className="text-slate-600">{c.cancel.text}</p>
              <Code code={ex.cancel} language="bash" c={c} />
            </Section>

            <Section id="delivery" title={c.delivery.title}>
              <Endpoint method="POST" path="/orders/{id}/delivery-events" tryId="delivery" c={c} />
              <p className="text-slate-600">{c.delivery.text}</p>
              <Code code={ex.delivery} language="bash" c={c} />
            </Section>

            <Section id="webhooks" title={c.webhooks.title}>
              <p className="text-slate-600">{c.webhooks.text}</p>
              <h3 className="mt-6 font-semibold text-slate-800">{c.webhooks.request}</h3>
              <Code code={ex.webhookRequest} language="HTTP" c={c} />
              <h3 className="mt-6 font-semibold text-slate-800">{c.webhooks.events}</h3>
              <Table head={[c.webhooks.colType, c.webhooks.colWhen, c.webhooks.colData]} rows={c.webhooks.eventList} />
              <h3 className="mt-6 font-semibold text-slate-800">{c.webhooks.replyTitle}</h3>
              <p className="text-slate-600">{c.webhooks.reply}</p>
            </Section>

            <Section id="signature" title={c.signature.title}>
              <p className="text-slate-600">{c.signature.text}</p>
              <Code code={ex.signature} language="Node.js" c={c} />
              <Code code={ex.signaturePhp} language="PHP" c={c} />
            </Section>

            <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-400">
              <p>{c.footer.version.replace('{year}', String(new Date().getFullYear()))}</p>
              <p className="mt-1">{c.footer.support}</p>
            </footer>
          </div>
        </main>
      </div>
    </div>
    </TryItProvider>
  );
}
