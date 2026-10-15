import type { ApiDocsContent } from './content';

// Documentation de l'API en un seul texte Markdown, prêt à coller dans un assistant IA
// (ChatGPT, Claude, Copilot…) : consigne en tête, puis tout le contenu de la page.

type Examples = Record<string, string>;

const table = (head: string[], rows: (string | boolean)[][]) =>
  [
    `| ${head.map((h) => h || ' ').join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`),
  ].join('\n');

const code = (value: string, language: string) => `\`\`\`${language}\n${value}\n\`\`\``;
const list = (items: string[]) => items.map((item) => `- ${item}`).join('\n');
const endpoint = (method: string, path: string) => `\`${method} /api/v1${path}\``;

export function buildApiPrompt(c: ApiDocsContent, ex: Examples, api: string, validationCodes: string[]) {
  const sections = [
    c.prompt.intro.replace('{api}', api),
    `# ${c.meta.title}`,

    `## ${c.intro.title}\n\n${c.intro.text}\n\n${c.intro.baseUrl} \`${api}\`\n\n${c.intro.flow.map((step, i) => `${i + 1}. ${step}`).join('\n')}`,

    `## ${c.auth.title}\n\n${c.auth.text}\n\n${c.auth.header}\n\n${code(ex.auth, 'http')}\n\n> ${c.auth.warning}`,

    `## ${c.responses.title}\n\n${c.responses.success}\n\n${code(ex.success, 'json')}\n\n${c.responses.error}\n\n${code(ex.error, 'json')}\n\n${table(
      [c.responses.colHttp, c.responses.colCode, c.responses.colMeaning],
      c.responses.errors
    )}\n\n${c.responses.amounts}`,

    `## ${c.limits.title}\n\n${c.limits.rate}\n\n${c.limits.quota}`,

    `## ${c.test.title}\n\n${c.test.text}\n\n${code(ex.testKey, 'http')}\n\n${list(c.test.rules)}\n\n### ${c.test.timelineTitle}\n\n${table(
      [c.test.colDelay, c.test.colStatus],
      c.test.timeline
    )}\n\n${c.test.reject}\n\n### ${c.test.webhookTitle}\n\n${endpoint('POST', '/sandbox/webhooks')}\n\n${c.test.webhook}\n\n${code(ex.testWebhook, 'bash')}\n\n${code(ex.testWebhookResponse, 'json')}`,

    `## ${c.point.title}\n\n${endpoint('GET', '/point')}\n\n${c.point.text}\n\n${code(ex.point, 'bash')}\n\n${code(ex.pointResponse, 'json')}`,

    `## ${c.menu.title}\n\n${endpoint('GET', '/menu')}\n\n${c.menu.text}\n\n${code(ex.menu, 'bash')}\n\n${code(ex.menuResponse, 'json')}`,

    `## ${c.categories.title}\n\n${endpoint('GET', '/categories')}\n\n${c.categories.text}\n\n${code(ex.categories, 'bash')}\n\n${code(ex.categoriesResponse, 'json')}`,

    `## ${c.deliveryZones.title}\n\n${endpoint('GET', '/delivery-zones')}\n\n${c.deliveryZones.text}\n\n${code(ex.deliveryZones, 'bash')}\n\n${code(
      ex.deliveryZonesResponse,
      'json'
    )}\n\n${c.deliveryZones.modes}\n\n${table(['delivery_by', ''], c.deliveryZones.modeList)}\n\n${code(ex.createOrderRestaurant, 'json')}`,

    `## ${c.lifecycle.title}\n\n${list(c.lifecycle.rules)}\n\n${table([c.lifecycle.statuses, ''], c.lifecycle.statusList)}`,

    `## ${c.createOrder.title}\n\n${endpoint('POST', '/orders')}\n\n${code(ex.createOrder, 'bash')}\n\n### ${c.createOrder.fields}\n\n${table(
      [c.createOrder.colField, c.createOrder.colRequired, c.createOrder.colDescription],
      c.createOrder.fieldList.map(([field, required, description]) => [field, required ? c.createOrder.yes : c.createOrder.no, description])
    )}\n\n${c.createOrder.response}\n\n> ${c.createOrder.idempotency}\n\n${c.createOrder.validation}\n\n${validationCodes.map((v) => `\`${v}\``).join(', ')}`,

    `## ${c.getOrder.title}\n\n${endpoint('GET', '/orders/{id}')}\n\n${c.getOrder.text}\n\n${code(ex.getOrder, 'bash')}\n\n${code(ex.order, 'json')}`,

    `## ${c.listOrders.title}\n\n${endpoint('GET', '/orders')}\n\n${c.listOrders.text}\n\n${table(
      [c.listOrders.colParam, c.listOrders.colDescription],
      c.listOrders.params
    )}\n\n${c.listOrders.paging}\n\n${code(ex.listOrders, 'bash')}\n\n${code(ex.listOrdersReconcile, 'bash')}\n\n${code(ex.listOrdersResponse, 'json')}`,

    `## ${c.cancel.title}\n\n${endpoint('POST', '/orders/{id}/cancel')}\n\n${c.cancel.text}\n\n${code(ex.cancel, 'bash')}`,

    `## ${c.delivery.title}\n\n${endpoint('POST', '/orders/{id}/delivery-events')}\n\n${c.delivery.text}\n\n${code(ex.delivery, 'bash')}`,

    `## ${c.webhooks.title}\n\n${c.webhooks.text}\n\n### ${c.webhooks.request}\n\n${code(ex.webhookRequest, 'http')}\n\n### ${c.webhooks.events}\n\n${table(
      [c.webhooks.colType, c.webhooks.colWhen, c.webhooks.colData],
      c.webhooks.eventList
    )}\n\n### ${c.webhooks.replyTitle}\n\n${c.webhooks.reply}`,

    `## ${c.signature.title}\n\n${c.signature.text}\n\n${code(ex.signature, 'javascript')}\n\n${code(ex.signaturePhp, 'php')}`,
  ];
  return sections.join('\n\n') + '\n';
}
