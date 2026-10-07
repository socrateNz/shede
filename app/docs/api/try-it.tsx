'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, Eye, EyeOff, FlaskConical, Loader2, Play, Plus, RotateCcw, Send, Trash2, X } from 'lucide-react';
import type { ApiDocsContent } from './content';

// Panneau « Essayer » de /docs/api : appelle l'API depuis le navigateur (même
// origine), avec la clé saisie. La clé reste en mémoire (jamais stockée).

type Method = 'GET' | 'POST';
type Param = { key: string; value: string; enabled: boolean };

type EndpointDef = {
  id: string;
  method: Method;
  path: string;
  query?: Param[];
  body?: (ctx: { productId: string | null }) => unknown;
};

export const TRY_ENDPOINTS: EndpointDef[] = [
  { id: 'point', method: 'GET', path: '/point' },
  { id: 'menu', method: 'GET', path: '/menu' },
  { id: 'categories', method: 'GET', path: '/categories' },
  { id: 'delivery-zones', method: 'GET', path: '/delivery-zones' },
  {
    id: 'create-order',
    method: 'POST',
    path: '/orders',
    body: ({ productId }) => ({
      external_id: `TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      partner: 'test',
      customer: { name: 'Test', phone: '699123456' },
      items: [{ product_id: productId ?? '<GET /menu → id>', quantity: 1 }],
    }),
  },
  { id: 'get-order', method: 'GET', path: '/orders/{id}' },
  {
    id: 'list-orders',
    method: 'GET',
    path: '/orders',
    query: [
      { key: 'updated_since', value: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) + 'T00:00:00Z', enabled: false },
      { key: 'created_from', value: new Date().toISOString().slice(0, 8) + '01', enabled: false },
      { key: 'created_to', value: new Date().toISOString().slice(0, 10), enabled: false },
      { key: 'status', value: 'picked_up,delivered', enabled: false },
      { key: 'limit', value: '50', enabled: true },
      { key: 'offset', value: '0', enabled: false },
    ],
  },
  { id: 'cancel', method: 'POST', path: '/orders/{id}/cancel', body: () => ({ reason: 'Client injoignable' }) },
  {
    id: 'delivery',
    method: 'POST',
    path: '/orders/{id}/delivery-events',
    body: () => ({ status: 'PICKED_UP', courier_name: 'Paul', courier_phone: '677000000' }),
  },
  { id: 'sandbox-webhooks', method: 'POST', path: '/sandbox/webhooks', body: () => ({ type: 'ping' }) },
];

const byId = (id: string) => TRY_ENDPOINTS.find((e) => e.id === id) ?? TRY_ENDPOINTS[0];
const pathParamsOf = (path: string) => [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

type TryItState = { open: (endpointId?: string) => void };
const TryItContext = createContext<TryItState | null>(null);

type ResponseState =
  { kind: 'ok'; status: number; ms: number; body: string; remaining: string | null } | { kind: 'error'; message: string };

export function TryItProvider({ c, locale, children }: { c: ApiDocsContent; locale: string; children: React.ReactNode }) {
  const t = c.tryIt;
  const [isOpen, setIsOpen] = useState(false);
  const [endpointId, setEndpointId] = useState('point');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [pathValues, setPathValues] = useState<Record<string, string>>({});
  const [query, setQuery] = useState<Param[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // Mémorisés pour enchaîner les appels : produit du menu, dernière commande créée.
  const [productId, setProductId] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [copied, setCopied] = useState<'curl' | 'response' | null>(null);

  const endpoint = byId(endpointId);
  const pathParams = pathParamsOf(endpoint.path);

  const select = useCallback(
    (id: string) => {
      const def = byId(id);
      setEndpointId(def.id);
      setQuery(def.query ? def.query.map((p) => ({ ...p })) : []);
      setBody(def.body ? JSON.stringify(def.body({ productId }), null, 2) : '');
      setPathValues((prev) => ({ ...prev, ...(lastOrderId && !prev.id ? { id: lastOrderId } : {}) }));
      setResponse(null);
      setProblem(null);
    },
    [productId, lastOrderId],
  );

  const open = useCallback(
    (id?: string) => {
      setIsOpen(true);
      if (id) select(id);
    },
    [select],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  function buildPath() {
    let path = endpoint.path;
    for (const name of pathParams) path = path.replace(`{${name}}`, encodeURIComponent((pathValues[name] ?? '').trim()));
    const search = new URLSearchParams();
    query.filter((p) => p.enabled && p.key.trim()).forEach((p) => search.append(p.key.trim(), p.value));
    const qs = search.toString();
    return `/api/v1${path}${qs ? `?${qs}` : ''}`;
  }

  function validate(): string | null {
    if (!token.trim()) return t.missingToken;
    const missing = pathParams.find((name) => !(pathValues[name] ?? '').trim());
    if (missing) return t.missingParam.replace('{name}', missing);
    if (endpoint.method === 'POST' && body.trim()) {
      try {
        JSON.parse(body);
      } catch {
        return t.invalidJson;
      }
    }
    return null;
  }

  async function send() {
    const error = validate();
    setProblem(error);
    if (error) return;
    setSending(true);
    setResponse(null);
    const started = performance.now();
    try {
      const res = await fetch(buildPath(), {
        method: endpoint.method,
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          'Accept-Language': locale,
          ...(endpoint.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        },
        body: endpoint.method === 'POST' ? body.trim() || '{}' : undefined,
        cache: 'no-store',
      });
      const text = await res.text();
      let pretty = text;
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
        pretty = JSON.stringify(parsed, null, 2);
      } catch {
        /* réponse non JSON : affichée telle quelle */
      }
      setResponse({
        kind: 'ok',
        status: res.status,
        ms: Math.round(performance.now() - started),
        body: pretty,
        remaining: res.headers.get('x-ratelimit-remaining'),
      });
      if (res.ok && parsed?.data) {
        if (endpoint.id === 'menu' && Array.isArray(parsed.data)) {
          const available = parsed.data.find((p: any) => p.is_available);
          if (available?.id) setProductId(available.id);
        }
        if (endpoint.id === 'create-order' && parsed.data.id) {
          setLastOrderId(parsed.data.id);
          setPathValues((prev) => ({ ...prev, id: parsed.data.id }));
        }
      }
    } catch (e) {
      setResponse({ kind: 'error', message: t.networkError.replace('{message}', (e as Error).message) });
    } finally {
      setSending(false);
    }
  }

  async function copy(kind: 'curl' | 'response') {
    let text = '';
    if (kind === 'curl') {
      const url = `${window.location.origin}${buildPath()}`;
      const parts = [
        `curl${endpoint.method === 'POST' ? ' -X POST' : ''} "${url}"`,
        `  -H "Authorization: Bearer ${token.trim() || '$SHEDE_KEY'}"`,
      ];
      if (endpoint.method === 'POST') {
        parts.push('  -H "Content-Type: application/json"', `  -d '${(body.trim() || '{}').replace(/'/g, "'\\''")}'`);
      }
      text = parts.join(' \\\n');
    } else if (response?.kind === 'ok') {
      text = response.body;
    }
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  const mode = token.startsWith('shd_live_') ? 'live' : token.startsWith('shd_test_') ? 'test' : null;
  const contextValue = useMemo(() => ({ open }), [open]);
  const statusTone =
    response?.kind === 'ok'
      ? response.status < 300
        ? 'bg-emerald-500/15 text-emerald-300'
        : response.status < 500
          ? 'bg-amber-500/15 text-amber-300'
          : 'bg-red-500/15 text-red-300'
      : '';

  return (
    <TryItContext.Provider value={contextValue}>
      <div className={isOpen ? 'xl:pr-[460px]' : ''}>{children}</div>

      {isOpen && (
        <aside
          aria-label={t.title}
          className="fixed inset-x-0 bottom-0 top-16 z-40 flex flex-col border-l border-slate-800 bg-slate-950 text-slate-200 shadow-2xl sm:left-auto sm:w-[460px]"
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <p className="font-semibold text-white">{t.title}</p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label={t.close}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {/* Requête */}
            <div className="flex gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2">
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${endpoint.method === 'GET' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-purple-500/20 text-purple-300'}`}
                >
                  {endpoint.method}
                </span>
                <select
                  value={endpoint.id}
                  onChange={(e) => select(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent py-2 font-mono text-sm text-slate-100 outline-none"
                >
                  {TRY_ENDPOINTS.map((e) => (
                    <option key={e.id} value={e.id} className="bg-slate-900">
                      {e.method} {e.path}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={send}
                disabled={sending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-60"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t.send}
              </button>
            </div>

            {/* Clé */}
            <div>
              <p className="mb-2 text-sm font-medium text-slate-300">{t.credentials}</p>
              <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900">
                <span className="border-r border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300">Bearer</span>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={t.tokenPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm text-slate-100 outline-none placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="px-3 text-slate-400 hover:text-white"
                  aria-label={t.toggleToken}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === 'live' && endpoint.method === 'POST' ? (
                <p className="mt-2 flex gap-1.5 text-xs text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t.liveWarning}
                </p>
              ) : (
                <p className="mt-2 flex gap-1.5 text-xs text-slate-400">
                  <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t.testHint} {t.keyMemory}
                </p>
              )}
            </div>

            {/* Paramètres de chemin */}
            {pathParams.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-slate-300">{t.pathParams}</p>
                {pathParams.map((name) => (
                  <label key={name} className="flex items-center gap-3 border-b border-slate-800 py-2">
                    <span className="w-24 shrink-0 font-mono text-sm text-slate-300">{name}</span>
                    <input
                      value={pathValues[name] ?? ''}
                      onChange={(e) => setPathValues((prev) => ({ ...prev, [name]: e.target.value }))}
                      placeholder="test_… / external_id"
                      spellCheck={false}
                      className="min-w-0 flex-1 rounded bg-slate-900 px-2 py-1.5 font-mono text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:ring-1 focus:ring-purple-500"
                    />
                  </label>
                ))}
                {lastOrderId && <p className="mt-1.5 text-xs text-slate-500">{t.orderHint}</p>}
              </div>
            )}

            {/* Paramètres de requête */}
            {endpoint.method === 'GET' && (endpoint.query || query.length > 0) && (
              <div>
                <p className="mb-2 text-sm font-medium text-slate-300">{t.queryParams}</p>
                {query.map((param, i) => (
                  <div key={i} className="flex items-center gap-2 border-b border-slate-800 py-1.5">
                    <input
                      type="checkbox"
                      checked={param.enabled}
                      onChange={(e) => setQuery((q) => q.map((p, j) => (j === i ? { ...p, enabled: e.target.checked } : p)))}
                      className="h-4 w-4 accent-purple-500"
                    />
                    <input
                      value={param.key}
                      onChange={(e) => setQuery((q) => q.map((p, j) => (j === i ? { ...p, key: e.target.value } : p)))}
                      placeholder={t.name}
                      className="w-32 rounded bg-transparent px-1 py-1 font-mono text-sm text-slate-300 outline-none focus:bg-slate-900"
                    />
                    <input
                      value={param.value}
                      onChange={(e) => setQuery((q) => q.map((p, j) => (j === i ? { ...p, value: e.target.value } : p)))}
                      placeholder={t.value}
                      className="min-w-0 flex-1 rounded bg-transparent px-1 py-1 font-mono text-sm text-slate-100 outline-none focus:bg-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setQuery((q) => q.filter((_, j) => j !== i))}
                      className="text-slate-500 hover:text-red-400"
                      aria-label={t.remove}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setQuery((q) => [...q, { key: '', value: '', enabled: true }])}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> {t.addParam}
                </button>
              </div>
            )}

            {/* Corps */}
            {endpoint.method === 'POST' && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-300">{t.body}</p>
                  {endpoint.body && (
                    <button
                      type="button"
                      onClick={() => setBody(JSON.stringify(endpoint.body!({ productId }), null, 2))}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> {t.resetBody}
                    </button>
                  )}
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={Math.min(16, Math.max(4, body.split('\n').length))}
                  spellCheck={false}
                  className="w-full resize-y rounded-lg border border-slate-700 bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100 outline-none focus:border-purple-500"
                />
                {endpoint.id === 'create-order' && !productId && <p className="mt-1.5 text-xs text-slate-500">{t.menuHint}</p>}
              </div>
            )}

            {problem && (
              <p className="flex gap-1.5 rounded-lg border border-red-900/60 bg-red-950/40 p-2.5 text-xs text-red-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {problem}
              </p>
            )}

            <button
              type="button"
              onClick={() => copy('curl')}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
            >
              {copied === 'curl' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} {t.copyCurl}
            </button>
          </div>

          {/* Réponse */}
          <div className="flex h-[42%] min-h-48 flex-col border-t border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-slate-300">{t.response}</span>
                {response?.kind === 'ok' && (
                  <>
                    <span className={`rounded px-1.5 py-0.5 font-mono text-xs font-bold ${statusTone}`}>{response.status}</span>
                    <span className="font-mono text-xs text-slate-500">{response.ms} ms</span>
                    {response.remaining && <span className="font-mono text-xs text-slate-500">· {response.remaining}/60</span>}
                  </>
                )}
              </div>
              {response?.kind === 'ok' && (
                <button
                  type="button"
                  onClick={() => copy('response')}
                  className="text-slate-400 hover:text-white"
                  aria-label={t.copyResponse}
                >
                  {copied === 'response' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
              {sending ? (
                <div className="flex h-full items-center justify-center text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : response?.kind === 'ok' ? (
                <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-slate-200">{response.body}</pre>
              ) : response?.kind === 'error' ? (
                <p className="text-sm text-red-300">{response.message}</p>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-500">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800">
                    <Play className="h-5 w-5" />
                  </span>
                  {t.empty}
                </div>
              )}
            </div>
          </div>
        </aside>
      )}
    </TryItContext.Provider>
  );
}

/** Bouton « Essayer » placé à côté d'un point d'accès de la documentation. */
export function TryItButton({
  endpointId,
  label,
  variant = 'inline',
}: {
  endpointId?: string;
  label: string;
  variant?: 'inline' | 'header';
}) {
  const context = useContext(TryItContext);
  if (!context) return null;
  return (
    <button
      type="button"
      onClick={() => context.open(endpointId)}
      className={
        variant === 'header'
          ? 'inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-700'
          : 'inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100'
      }
    >
      <Play className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
