'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Bell, ChevronLeft, ClipboardList, CloudOff, LayoutGrid, LayoutDashboard, Loader2, LogOut, Minus, Plus, RotateCw, Search, Send, Trash2, X } from 'lucide-react';
import {
  fireHeldItems,
  getWaiterFloor,
  getWaiterOrders,
  markOrderServed,
  submitWaiterOrder,
  type WaiterMenu,
  type WaiterFloorPlan,
  type WaiterOrder,
  type WaiterTable,
} from '@/app/actions/waiter';
import { waiterLogout } from '@/app/actions/waiter-devices';
import { FloorLegend, FloorList, FloorPlan, tableState } from '@/components/waiter/floor-plan';
import { enableWaiterPush, registerWaiterWorker, releaseWaiterDevice } from '@/components/waiter/push';
import { loadQueue, loadResolved, saveQueue, saveResolved, type QueuedOrder } from '@/components/waiter/offline-queue';
import { useDialogs } from '@/components/dialog-provider';
import type { WaiterOrderInput } from '@/app/actions/waiter';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

type Floor = WaiterFloorPlan;
type Screen = 'floor' | 'order' | 'review' | 'orders';
type Line = { key: string; productId: string; qty: number; note: string; accompaniments: string[] };
/** Table servie : groupe existant (orderId) ou nouveau groupe avec ses couverts. */
type Active = {
  tableId: string;
  orderId: string | null;
  covers: number | null;
  /** Groupe ouvert hors ligne : envoi qui le créera (les ajouts s'y rattachent). */
  queuedRef?: string;
};

const ACCENT = '#6d28d9';
const REFRESH_MS = 10_000;

/** Identifiant d'envoi : randomUUID n'existe qu'en HTTPS, d'où le repli (réseau local en http). */
function newRef() {
  try {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {}
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const lineKey = (productId: string, accompaniments: string[]) => `${productId}|${[...accompaniments].sort().join(',')}`;

export function WaiterApp({
  me,
  initialFloor,
  menu,
  initialOrders,
  pinSession = false,
}: {
  me: { id: string; name: string; initials: string };
  initialFloor: Floor;
  menu: WaiterMenu;
  initialOrders: WaiterOrder[];
  /** Connecté par code PIN sur un téléphone partagé : pas de back-office, « Changer de serveur ». */
  pinSession?: boolean;
}) {
  const { t, format } = useT();
  const [screen, setScreen] = useState<Screen>('floor');
  const [floor, setFloor] = useState<Floor>(initialFloor);
  const [orders, setOrders] = useState<WaiterOrder[]>(initialOrders);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [coversFor, setCoversFor] = useState<{ table: WaiterTable; max: number } | null>(null);
  const [tableSheet, setTableSheet] = useState<WaiterTable | null>(null);
  const [floorId, setFloorId] = useState<string>(initialFloor.floors[0]?.id ?? 'default');
  const [view, setView] = useState<'plan' | 'list'>('plan');
  const [active, setActive] = useState<Active | null>(null);
  const [cart, setCart] = useState<Line[]>([]);
  const [category, setCategory] = useState<string>(menu.favorites.length ? 'fav' : 'all');
  const [search, setSearch] = useState('');
  const [accSheet, setAccSheet] = useState<{ productId: string; selected: string[] } | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [sendMode, setSendMode] = useState<'all' | 'staged'>('all');
  const [sending, setSending] = useState(false);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  // Identifiant de l'envoi en cours : gardé pour un nouvel essai (anti-doublon), oublié dès que le panier change
  const pendingRef = useRef<string | null>(null);
  const dialogs = useDialogs();
  const [queue, setQueue] = useState<QueuedOrder[]>([]);
  const queueRef = useRef<QueuedOrder[]>([]);
  const [online, setOnline] = useState(true);
  const syncing = useRef(false);
  const knownReady = useRef(new Set(initialOrders.filter((o) => o.status === 'READY').map((o) => o.id)));

  const productById = useMemo(() => new Map(menu.products.map((p) => [p.id, p])), [menu.products]);
  const tableById = useMemo(() => new Map(floor.tables.map((tb) => [tb.id, tb])), [floor.tables]);

  // ── Rafraîchissement (plan de salle et suivi) + alerte « commande prête » ──
  const refresh = useCallback(async () => {
    try {
      const [f, o] = await Promise.all([getWaiterFloor(), getWaiterOrders()]);
      if (f) setFloor(f);
      if (o) {
        for (const order of o) {
          if (order.status === 'READY' && !knownReady.current.has(order.id)) {
            knownReady.current.add(order.id);
            toast.success(t('waiter.orders.readyToast', { table: order.tableName }), { description: t('waiter.orders.readyToastText'), duration: 8000 });
            if ('vibrate' in navigator) navigator.vibrate?.([200, 100, 200]);
          }
        }
        setOrders(o);
      }
    } catch {
      // Réseau coupé : on garde les dernières données, nouvel essai au prochain tour.
    }
  }, [t]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // ── Panier ──
  const changeCart = (updater: (lines: Line[]) => Line[]) => {
    pendingRef.current = null;
    setCart((lines) => updater(lines).filter((l) => l.qty > 0));
  };
  const addLine = (productId: string, accompaniments: string[] = []) =>
    changeCart((lines) => {
      const key = lineKey(productId, accompaniments);
      // Même plat, mêmes accompagnements, sans note : on augmente la quantité de la ligne
      const existing = lines.find((l) => l.key.split('#')[0] === key && !l.note);
      if (existing) return lines.map((l) => (l === existing ? { ...l, qty: Math.min(99, l.qty + 1) } : l));
      return [...lines, { key: `${key}#${Date.now()}`, productId, qty: 1, note: '', accompaniments }];
    });
  const removeOne = (productId: string) =>
    changeCart((lines) => {
      const idx = lines.map((l) => l.productId).lastIndexOf(productId);
      if (idx < 0) return lines;
      return lines.map((l, i) => (i === idx ? { ...l, qty: l.qty - 1 } : l));
    });
  const setLine = (key: string, patch: Partial<Line>) => changeCart((lines) => lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const qtyByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of cart) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty);
    return m;
  }, [cart]);
  const lineTotal = (l: Line) => {
    const p = productById.get(l.productId);
    if (!p) return 0;
    const acc = l.accompaniments.reduce((s, id) => {
      const a = p.accompaniments.find((x) => x.id === id);
      return s + (a ? a.price * a.quantity : 0);
    }, 0);
    return (p.price + acc) * l.qty;
  };
  const cartCount = cart.reduce((n, l) => n + l.qty, 0);
  const cartTotal = cart.reduce((n, l) => n + lineTotal(l), 0);

  // ── Ouverture d'une table ──
  /** Groupes ouverts hors ligne sur une table : envois qui créeront un groupe, pas encore partis. */
  const queuedGroups = (tableId: string) =>
    queue.filter((q) => q.payload.tableId === tableId && !q.payload.orderId && !q.groupRef && q.status === 'pending');
  const seatsFreeWithQueue = (table: WaiterTable) =>
    Math.max(0, table.seatsFree - queuedGroups(table.id).reduce((n, q) => n + (q.payload.covers ?? 0), 0));

  const openTable = (table: WaiterTable) => {
    // Table vide (y compris hors ligne) : couverts ; sinon fiche : groupes en cours ou nouveau groupe
    if (!table.groups.length && !queuedGroups(table.id).length) setCoversFor({ table, max: table.capacity || 8 });
    else setTableSheet(table);
  };
  const startOrder = (a: Active) => {
    setActive(a);
    pendingRef.current = null;
    setCart([]);
    setSearch('');
    setNoteFor(null);
    setSendMode('all');
    setCategory(menu.favorites.length ? 'fav' : 'all');
    setScreen('order');
  };

  // ── Carte filtrée ──
  const rootCategories = useMemo(() => {
    const used = new Set(menu.products.flatMap((p) => p.categoryIds));
    const parentOf = new Map(menu.categories.map((c) => [c.id, c.parentId]));
    const roots = new Set<string>();
    used.forEach((id) => roots.add(parentOf.get(id) ?? id));
    return menu.categories.filter((c) => !c.parentId && roots.has(c.id));
  }, [menu]);
  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) return menu.products.filter((p) => p.name.toLowerCase().includes(q));
    if (category === 'fav') return menu.favorites.map((id) => productById.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    if (category === 'all') return menu.products;
    const children = new Set(menu.categories.filter((c) => c.parentId === category).map((c) => c.id));
    return menu.products.filter((p) => p.categoryIds.some((id) => id === category || children.has(id)));
  }, [menu, category, search, productById]);

  // ── Envoi ──
  // ── File hors ligne ──
  const setQueueBoth = useCallback(
    (next: QueuedOrder[]) => {
      queueRef.current = next;
      setQueue(next);
      saveQueue(me.id, next);
    },
    [me.id],
  );

  /** Envoie les commandes gardées sur le téléphone, dans l'ordre de saisie. */
  const syncQueue = useCallback(async () => {
    if (syncing.current || !queueRef.current.some((q) => q.status === 'pending')) return;
    syncing.current = true;
    let sent = 0;
    try {
      const resolved = loadResolved(me.id);
      for (const entry of [...queueRef.current]) {
        if (entry.status !== 'pending') continue;
        const payload: WaiterOrderInput = { ...entry.payload };
        if (entry.groupRef) {
          const orderId = resolved[entry.groupRef];
          const creator = queueRef.current.find((q) => q.ref === entry.groupRef);
          if (orderId) payload.orderId = orderId;
          else if (creator?.status === 'pending') break; // le groupe partira d'abord
          else {
            setQueueBoth(queueRef.current.map((q) => (q.ref === entry.ref ? { ...q, status: 'failed', error: t('waiter.offline.groupMissing') } : q)));
            continue;
          }
        }
        let result: Awaited<ReturnType<typeof submitWaiterOrder>>;
        try {
          result = await submitWaiterOrder(payload);
        } catch {
          break; // toujours sans réseau : on réessaiera
        }
        if (result.success) {
          resolved[entry.ref] = result.orderId;
          saveResolved(me.id, resolved);
          setQueueBoth(queueRef.current.filter((q) => q.ref !== entry.ref));
          setActive((cur) => (cur?.queuedRef === entry.ref ? { ...cur, orderId: result.orderId, queuedRef: undefined } : cur));
          sent++;
        } else {
          setQueueBoth(queueRef.current.map((q) => (q.ref === entry.ref ? { ...q, status: 'failed', error: result.error } : q)));
        }
      }
    } finally {
      syncing.current = false;
    }
    if (sent) {
      toast.success(t('waiter.offline.synced', { count: sent }));
      refresh();
    }
  }, [me.id, refresh, setQueueBoth, t]);

  // File relue au démarrage ; envoi au retour du réseau
  useEffect(() => {
    const initial = loadQueue(me.id);
    queueRef.current = initial;
    setQueue(initial);
    setOnline(navigator.onLine);
    const goOnline = () => {
      setOnline(true);
      syncQueue();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    if (navigator.onLine) syncQueue();
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [me.id, syncQueue]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') syncQueue();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [syncQueue]);

  const send = async () => {
    if (!active || !cart.length || sending) return;
    setSending(true);
    pendingRef.current ??= newRef();
    const ref = pendingRef.current;
    const payload: WaiterOrderInput = {
      ref,
      tableId: active.tableId,
      orderId: active.orderId,
      covers: active.orderId || active.queuedRef ? null : active.covers,
      items: cart.map((l) => ({
        productId: l.productId,
        quantity: l.qty,
        note: l.note || null,
        held: sendMode === 'staged' && productById.get(l.productId)?.station === 'CUISINE',
        accompaniments: l.accompaniments,
      })),
    };
    const afterSent = (orderId: string | null) => {
      pendingRef.current = null;
      setCart([]);
      setActive((a) => (a ? (orderId ? { ...a, orderId, queuedRef: undefined } : a.orderId || a.queuedRef ? a : { ...a, queuedRef: ref }) : a));
      setScreen('orders');
    };
    const enqueue = () => {
      const entry: QueuedOrder = {
        ref,
        payload,
        groupRef: !active.orderId && active.queuedRef ? active.queuedRef : undefined,
        tableName: activeTable?.name ?? '',
        lineCount: cartCount,
        total: cartTotal,
        createdAt: new Date().toISOString(),
        status: 'pending',
      };
      setQueueBoth([...queueRef.current, entry]);
      afterSent(null);
      toast.message(t('waiter.offline.queued'), { icon: <CloudOff className="h-4 w-4" /> });
    };

    try {
      // Des commandes attendent déjà, ou pas de réseau : celle-ci passe derrière (ordre conservé)
      if (!navigator.onLine || queueRef.current.length > 0 || active.queuedRef) {
        enqueue();
        syncQueue();
        return;
      }
      let result: Awaited<ReturnType<typeof submitWaiterOrder>>;
      try {
        result = await submitWaiterOrder(payload);
      } catch {
        // Requête perdue : gardée sur le téléphone avec le même identifiant (pas de doublon)
        enqueue();
        return;
      }
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      afterSent(result.orderId);
      toast.success(t('waiter.review.sent'));
      await refresh();
    } finally {
      setSending(false);
    }
  };

  const retryQueued = (ref: string) => {
    setQueueBoth(queueRef.current.map((q) => (q.ref === ref ? { ...q, status: 'pending', error: undefined } : q)));
    syncQueue();
  };
  const deleteQueued = async (ref: string) => {
    if (!(await dialogs.confirm({ description: t('waiter.offline.deleteConfirm'), destructive: true, tone: 'light' }))) return;
    setQueueBoth(queueRef.current.filter((q) => q.ref !== ref));
  };

  const fire = async (orderId: string) => {
    setBusyOrder(orderId);
    try {
      const r = await fireHeldItems(orderId);
      if (!r.success) toast.error(r.error);
      else toast.success(t('waiter.orders.fired'));
      await refresh();
    } catch {
      toast.error(t('waiter.errors.network'));
    } finally {
      setBusyOrder(null);
    }
  };
  const serve = async (orderId: string) => {
    setBusyOrder(orderId);
    try {
      const r = await markOrderServed(orderId);
      if (!r.success) toast.error(r.error);
      else toast.success(t('waiter.orders.served'));
      await refresh();
    } catch {
      toast.error(t('waiter.errors.network'));
    } finally {
      setBusyOrder(null);
    }
  };

  const activeTable = active ? tableById.get(active.tableId) : undefined;
  const readyCount = orders.filter((o) => o.status === 'READY').length;
  const currentFloorId = floor.floors.some((f) => f.id === floorId) ? floorId : floor.floors[0]?.id;
  const floorTables = floor.tables.filter((tb) => tb.floorId === currentFloorId);
  const listTables = floorTables.filter((tb) => filter === 'all' || tb.groups.some((g) => g.mine));
  // Alertes « commande prête » : abonnement silencieux si déjà autorisé, sinon bouton d'activation.
  const [alerts, setAlerts] = useState<NotificationPermission | 'unsupported' | null>(null);
  useEffect(() => {
    registerWaiterWorker();
    enableWaiterPush(false)
      .then(setAlerts)
      .catch(() => setAlerts('unsupported'));
  }, []);
  const askAlerts = async () => {
    const result = await enableWaiterPush(true).catch(() => 'unsupported' as const);
    setAlerts(result);
    if (result === 'granted') toast.success(t('waiter.alerts.enabled'));
    else if (result === 'denied') toast.error(t('waiter.alerts.denied'));
  };

  // Changement de serveur : le téléphone cesse de recevoir les alertes du serveur sortant.
  const logout = async () => {
    await releaseWaiterDevice();
    await waiterLogout();
  };

  const quickNotes = t('waiter.review.quickNotes').split('|');

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden bg-[#f6f5f2] shadow-xl">
      {/* ═════════ Plan de salle ═════════ */}
      {screen === 'floor' && (
        <>
          <header className="flex items-center justify-between border-b border-[#e7e5df] bg-white px-5 pb-3 pt-5">
            <div>
              <p className="text-[13px] font-semibold text-[#5b5e66]">{t('waiter.floor.hello', { name: me.name })}</p>
              <h1 className="text-[22px] font-extrabold">{t('waiter.floor.title')}</h1>
            </div>
            {pinSession ? (
              <form action={logout}>
                <button
                  type="submit"
                  aria-label={t('waiter.pin.switch')}
                  title={t('waiter.pin.switch')}
                  className="flex h-12 items-center gap-2 rounded-full bg-[#ede9fe] pl-1.5 pr-3 text-sm font-bold text-[#4c1d95]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-base font-extrabold">{me.initials}</span>
                  <LogOut className="h-4 w-4" aria-hidden />
                </button>
              </form>
            ) : (
              <Link
                href="/dashboard"
                aria-label={t('waiter.nav.backOffice')}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ede9fe] text-base font-extrabold text-[#4c1d95]"
              >
                {me.initials}
              </Link>
            )}
          </header>

          {(!online || queue.length > 0) && (
            <div className={cn('mx-4 mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold', online ? 'bg-[#e8f3ff] text-[#0b4a8b]' : 'bg-[#fff4e0] text-[#7a4a00]')}>
              <CloudOff className="h-5 w-5 shrink-0" aria-hidden />
              <span className="flex-1">
                {online ? t('waiter.offline.pendingBanner', { count: queue.length }) : queue.length ? t('waiter.offline.banner', { count: queue.length }) : t('waiter.offline.bannerEmpty')}
              </span>
              {online && queue.some((q) => q.status === 'pending') && (
                <button type="button" onClick={syncQueue} className="h-10 rounded-xl bg-[#0b4a8b] px-3 font-bold text-white">
                  {t('waiter.offline.sendNow')}
                </button>
              )}
            </div>
          )}
          {alerts === 'default' && (
            <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-[#ede9fe] px-4 py-3 text-sm font-semibold text-[#4c1d95]">
              <Bell className="h-5 w-5 shrink-0" aria-hidden />
              <span className="flex-1">{t('waiter.alerts.prompt')}</span>
              <button type="button" onClick={askAlerts} className="h-10 rounded-xl bg-[#4c1d95] px-3 font-bold text-white">
                {t('waiter.alerts.enable')}
              </button>
            </div>
          )}
          {!floor.registerOpen && (
            <p className="mx-4 mt-3 rounded-2xl bg-[#fff4e0] px-4 py-3 text-sm font-semibold text-[#7a4a00]">{t('waiter.floor.registerClosed')}</p>
          )}

          {floor.floors.length > 1 && (
            <div className="flex gap-2 overflow-x-auto border-b border-[#e7e5df] bg-white px-4 pb-3 pt-1 [scrollbar-width:none]" role="tablist">
              {floor.floors.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={f.id === currentFloorId}
                  onClick={() => setFloorId(f.id)}
                  className={cn('h-10 shrink-0 rounded-full px-4 text-sm font-bold', f.id === currentFloorId ? 'bg-[#17181c] text-white' : 'bg-[#f1efe9] text-[#17181c]')}
                >
                  {f.name || t('waiter.floor.title')}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 px-4 pb-2 pt-3">
            {(['all', 'mine'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn('h-11 rounded-full px-4 text-[15px] font-bold', filter === f ? 'bg-[#17181c] text-white' : 'bg-white text-[#17181c]')}
              >
                {t(f === 'all' ? 'waiter.floor.all' : 'waiter.floor.mine')}
              </button>
            ))}
            <div className="ml-auto flex rounded-full bg-white p-1">
              {(['plan', 'list'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cn('h-9 rounded-full px-3 text-sm font-bold', view === v ? 'bg-[#ede9fe] text-[#4c1d95]' : 'text-[#5b5e66]')}
                >
                  {t(v === 'plan' ? 'waiter.floor.planView' : 'waiter.floor.listView')}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1">
            {floorTables.length === 0 ? (
              <p className="px-2 py-12 text-center text-[15px] text-[#5b5e66]">{t('waiter.floor.empty')}</p>
            ) : view === 'plan' ? (
              <div className="flex flex-col gap-2.5">
                <FloorPlan tables={floorTables} mineOnly={filter === 'mine'} onOpen={openTable} />
                <FloorLegend />
              </div>
            ) : listTables.length === 0 ? (
              <p className="px-2 py-12 text-center text-[15px] text-[#5b5e66]">{t('waiter.floor.emptyMine')}</p>
            ) : (
              <FloorList tables={listTables} onOpen={openTable} />
            )}
          </div>
        </>
      )}

      {/* ═════════ Prise de commande ═════════ */}
      {screen === 'order' && active && (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <header className="flex items-center gap-2 border-b border-[#e7e5df] bg-white px-3 py-3">
            <button type="button" onClick={() => setScreen('floor')} aria-label={t('waiter.order.back')} className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#f1efe9]">
              <ChevronLeft className="h-6 w-6" aria-hidden />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-extrabold">{activeTable?.name ?? ''}</p>
              <p className="text-[13px] text-[#5b5e66]">
                {[active.orderId ? t('waiter.order.addTo') : t('waiter.order.newOrder'), active.covers ? t('waiter.order.coversSub', { count: active.covers }) : '']
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </header>

          <div className="bg-white px-4 pb-1.5 pt-3">
            <label htmlFor="waiter-search" className="sr-only">
              {t('waiter.order.search')}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5b5e66]" aria-hidden />
              <input
                id="waiter-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('waiter.order.search')}
                className="h-12 w-full rounded-[14px] border border-[#d9d6ce] bg-[#f6f5f2] pl-10 pr-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto border-b border-[#e7e5df] bg-white px-4 pb-3 pt-2.5 [scrollbar-width:none]">
            {[
              ...(menu.favorites.length ? [{ id: 'fav', name: t('waiter.order.favorites') }] : []),
              { id: 'all', name: t('waiter.order.all') },
              ...rootCategories.map((c) => ({ id: c.id, name: c.name })),
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.id && !search}
                onClick={() => {
                  setCategory(c.id);
                  setSearch('');
                }}
                className={cn('h-10 shrink-0 rounded-full px-4 text-sm font-bold', category === c.id && !search ? 'bg-[#17181c] text-white' : 'bg-[#f1efe9] text-[#17181c]')}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-2">
            {category === 'fav' && !search && <p className="mb-2 mt-2 text-[13px] font-bold uppercase tracking-wide text-[#5b5e66]">{t('waiter.order.bestSellers')}</p>}
            <div className="flex flex-col gap-2">
              {visibleProducts.map((p) => {
                const qty = qtyByProduct.get(p.id) ?? 0;
                return (
                  <div key={p.id} className="flex min-h-16 items-center gap-3 rounded-2xl bg-white py-2.5 pl-3.5 pr-2.5 shadow-[0_1px_2px_rgba(23,24,28,.06)]">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold leading-tight">{p.name}</p>
                      <p className="text-sm text-[#5b5e66]">
                        {format.money(p.price)} · {t(p.station === 'BAR' ? 'waiter.order.bar' : 'waiter.order.kitchen')}
                      </p>
                    </div>
                    {qty > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => removeOne(p.id)}
                          aria-label={t('waiter.order.remove', { name: p.name })}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1efe9]"
                        >
                          <Minus className="h-5 w-5" aria-hidden />
                        </button>
                        <span className="min-w-[26px] text-center text-lg font-extrabold">{qty}</span>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => (p.accompaniments.length ? setAccSheet({ productId: p.id, selected: [] }) : addLine(p.id))}
                      aria-label={t('waiter.order.add', { name: p.name })}
                      className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] text-white"
                      style={{ background: ACCENT }}
                    >
                      <Plus className="h-6 w-6" aria-hidden />
                    </button>
                  </div>
                );
              })}
              {visibleProducts.length === 0 && (
                <p className="px-2 py-8 text-center text-[15px] text-[#5b5e66]">
                  {search ? t('waiter.order.noResult', { query: search }) : t('waiter.order.noFavorites')}
                </p>
              )}
            </div>
          </div>

          {cartCount > 0 && (
            <div className="absolute inset-x-3 bottom-4">
              <button
                type="button"
                onClick={() => setScreen('review')}
                className="flex h-16 w-full items-center justify-between rounded-[18px] bg-[#17181c] px-5 text-white shadow-[0_8px_24px_rgba(23,24,28,.25)]"
              >
                <span className="flex items-center gap-2.5 font-bold">
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm" style={{ background: ACCENT }}>
                    {cartCount}
                  </span>
                  {t('waiter.order.viewCart')}
                </span>
                <span className="text-[17px] font-extrabold">{format.money(cartTotal)}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═════════ Vérifier et envoyer ═════════ */}
      {screen === 'review' && active && (
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center gap-2 border-b border-[#e7e5df] bg-white px-3 py-3">
            <button type="button" onClick={() => setScreen('order')} aria-label={t('waiter.review.backToMenu')} className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#f1efe9]">
              <ChevronLeft className="h-6 w-6" aria-hidden />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-extrabold">{t('waiter.review.title', { table: activeTable?.name ?? '' })}</p>
              <p className="text-[13px] text-[#5b5e66]">{t('waiter.review.subtitle')}</p>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
            {cart.length === 0 && <p className="py-10 text-center text-[#5b5e66]">{t('waiter.review.empty')}</p>}
            {cart.map((l) => {
              const p = productById.get(l.productId);
              if (!p) return null;
              const accNames = l.accompaniments.map((id) => p.accompaniments.find((a) => a.id === id)?.name).filter(Boolean);
              const editing = noteFor === l.key;
              return (
                <div key={l.key} className="flex flex-col gap-2 rounded-2xl bg-white py-3 pl-3.5 pr-3">
                  <div className="flex items-center gap-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold leading-tight">{p.name}</p>
                      <p className="text-[13px] text-[#5b5e66]">
                        {t(p.station === 'BAR' ? 'waiter.order.bar' : 'waiter.order.kitchen')} · {format.money(lineTotal(l))}
                      </p>
                      {accNames.length > 0 && <p className="text-[13px] text-[#5b5e66]">{t('waiter.review.accompaniments', { names: accNames.join(', ') })}</p>}
                    </div>
                    <button type="button" onClick={() => setLine(l.key, { qty: l.qty - 1 })} aria-label={t('waiter.order.remove', { name: p.name })} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1efe9]">
                      <Minus className="h-5 w-5" aria-hidden />
                    </button>
                    <span className="min-w-6 text-center text-lg font-extrabold">{l.qty}</span>
                    <button type="button" onClick={() => setLine(l.key, { qty: Math.min(99, l.qty + 1) })} aria-label={t('waiter.order.add', { name: p.name })} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1efe9]">
                      <Plus className="h-5 w-5" aria-hidden />
                    </button>
                  </div>
                  {!editing && !l.note && (
                    <button type="button" onClick={() => setNoteFor(l.key)} className="min-h-9 self-start text-sm font-semibold text-[#5b21b6]">
                      {t('waiter.review.addNote')}
                    </button>
                  )}
                  {!editing && l.note && (
                    <button type="button" onClick={() => setNoteFor(l.key)} className="self-start rounded-[10px] bg-[#fff4e0] px-2.5 py-1.5 text-left text-sm font-semibold text-[#7a4a00]">
                      {t('waiter.review.notePrefix', { note: l.note })}
                    </button>
                  )}
                  {editing && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {quickNotes.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setLine(l.key, { note: l.note ? `${l.note}, ${q.toLowerCase()}` : q })}
                            className="h-[34px] rounded-full bg-[#f1efe9] px-3 text-[13px] font-semibold"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                      <label htmlFor={`note-${l.key}`} className="text-xs font-semibold text-[#5b5e66]">
                        {t('waiter.review.noteLabel')}
                      </label>
                      <input
                        id={`note-${l.key}`}
                        value={l.note}
                        maxLength={140}
                        onChange={(e) => setLine(l.key, { note: e.target.value })}
                        onBlur={() => setNoteFor(null)}
                        placeholder={t('waiter.review.notePlaceholder')}
                        className="h-11 rounded-xl border border-[#d9d6ce] bg-[#f6f5f2] px-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]"
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {cart.length > 0 && (
              <>
                <div className="mt-1 flex flex-col gap-2.5 rounded-2xl bg-white p-3.5">
                  <p className="text-[15px] font-bold">{t('waiter.review.sendTitle')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['all', 'staged'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={sendMode === m}
                        onClick={() => setSendMode(m)}
                        className={cn('min-h-16 rounded-[14px] border-2 p-2.5 text-left', sendMode === m ? 'bg-[#f5f3ff]' : 'border-[#e7e5df] bg-white')}
                        style={sendMode === m ? { borderColor: ACCENT } : undefined}
                      >
                        <span className="block text-sm font-bold">{t(m === 'all' ? 'waiter.review.sendAll' : 'waiter.review.sendStaged')}</span>
                        <span className="mt-0.5 block text-xs text-[#3d4048]">{t(m === 'all' ? 'waiter.review.sendAllHint' : 'waiter.review.sendStagedHint')}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-baseline justify-between px-1 pt-1.5">
                  <span className="text-[15px] font-semibold text-[#5b5e66]">{t('waiter.review.total')}</span>
                  <span className="text-2xl font-extrabold">{format.money(cartTotal)}</span>
                </div>
              </>
            )}
          </div>

          <div className="border-t border-[#e7e5df] bg-white px-4 pb-5 pt-3">
            {!floor.registerOpen && <p className="mb-2 text-center text-[13px] font-semibold text-[#7a4a00]">{t('waiter.floor.registerClosed')}</p>}
            <button
              type="button"
              onClick={send}
              disabled={sending || cart.length === 0 || !floor.registerOpen}
              className="flex h-[60px] w-full items-center justify-center gap-2 rounded-[18px] text-[17px] font-extrabold text-white disabled:opacity-60"
              style={{ background: ACCENT }}
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Send className="h-5 w-5" aria-hidden />}
              {sending ? t('waiter.review.sending') : online ? t('waiter.review.send', { amount: format.money(cartTotal) }) : t('waiter.offline.keep', { amount: format.money(cartTotal) })}
            </button>
          </div>
        </div>
      )}

      {/* ═════════ Suivi ═════════ */}
      {screen === 'orders' && (
        <>
          <header className="border-b border-[#e7e5df] bg-white px-5 pb-3.5 pt-5">
            <p className="text-[13px] font-semibold text-[#5b5e66]">{me.name}</p>
            <h1 className="text-[22px] font-extrabold">{t('waiter.orders.title')}</h1>
          </header>
          {(!online || queue.length > 0) && (
            <div className={cn('mx-4 mt-3 mb-1 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold', online ? 'bg-[#e8f3ff] text-[#0b4a8b]' : 'bg-[#fff4e0] text-[#7a4a00]')}>
              <CloudOff className="h-5 w-5 shrink-0" aria-hidden />
              <span className="flex-1">
                {online ? t('waiter.offline.pendingBanner', { count: queue.length }) : queue.length ? t('waiter.offline.banner', { count: queue.length }) : t('waiter.offline.bannerEmpty')}
              </span>
              {online && queue.some((q) => q.status === 'pending') && (
                <button type="button" onClick={syncQueue} className="h-10 rounded-xl bg-[#0b4a8b] px-3 font-bold text-white">
                  {t('waiter.offline.sendNow')}
                </button>
              )}
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
            {queue.length > 0 && (
              <section aria-labelledby="queued-title" className="flex flex-col gap-2">
                <h2 id="queued-title" className="text-[13px] font-bold uppercase tracking-wide text-[#5b5e66]">
                  {t('waiter.offline.queuedTitle')}
                </h2>
                {queue.map((q) => (
                  <div key={q.ref} className={cn('flex flex-col gap-2 rounded-2xl border-2 border-dashed bg-white p-3.5', q.status === 'failed' ? 'border-[#b42318]' : 'border-[#d9a441]')}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-lg font-extrabold">{q.tableName}</p>
                      <span className={cn('rounded-full px-2.5 py-1 text-[13px] font-bold', q.status === 'failed' ? 'bg-[#fee4e2] text-[#b42318]' : 'bg-[#fff4e0] text-[#7a4a00]')}>
                        {q.status === 'failed' ? t('waiter.offline.failedChip') : t('waiter.offline.waiting')}
                      </span>
                    </div>
                    <p className="text-sm text-[#3d4048]">
                      {t('waiter.offline.items', { count: q.lineCount })} · {format.money(q.total)} · {format.time(q.createdAt)}
                    </p>
                    {q.status === 'failed' && q.error && <p className="text-sm font-semibold text-[#b42318]">{q.error}</p>}
                    <div className="flex gap-2">
                      {q.status === 'failed' && (
                        <button type="button" onClick={() => retryQueued(q.ref)} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[14px] bg-[#f1efe9] font-bold">
                          <RotateCw className="h-4 w-4" aria-hidden /> {t('waiter.offline.retry')}
                        </button>
                      )}
                      <button type="button" onClick={() => deleteQueued(q.ref)} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[14px] bg-[#fee4e2] font-bold text-[#b42318]">
                        <Trash2 className="h-4 w-4" aria-hidden /> {t('waiter.offline.delete')}
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}
            {orders.length === 0 && queue.length === 0 && <p className="py-12 text-center text-[15px] text-[#5b5e66]">{t('waiter.orders.empty')}</p>}
            {orders.map((o) => {
              const held = o.lines.filter((l) => l.held);
              const ready = o.status === 'READY';
              return (
                <div key={o.id} className={cn('flex flex-col gap-2.5 rounded-2xl border-2 bg-white p-3.5', ready ? 'border-[#0f7a3f]' : 'border-white')}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-extrabold">{o.tableName}</p>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[13px] font-bold',
                        ready ? 'bg-[#0f7a3f] text-white' : o.status === 'SERVED' ? 'bg-[#f1efe9] text-[#3d4048]' : 'bg-[#fff4e0] text-[#7a4a00]',
                      )}
                    >
                      {t(`waiter.orders.status.${o.status as 'PENDING'}`)}
                    </span>
                  </div>
                  <p className="text-sm text-[#3d4048]">
                    {o.lines
                      .filter((l) => !l.held)
                      .map((l) => `${l.quantity} × ${l.name}${l.note ? ` (${l.note})` : ''}`)
                      .join(', ')}
                  </p>
                  {held.length > 0 && (
                    <p className="rounded-[10px] bg-[#f5f3ff] px-2.5 py-1.5 text-sm font-semibold text-[#4c1d95]">
                      {t('waiter.orders.held', { count: held.reduce((n, l) => n + l.quantity, 0) })} : {held.map((l) => `${l.quantity} × ${l.name}`).join(', ')}
                    </p>
                  )}
                  <p className="text-xs text-[#5b5e66]">
                    {t('waiter.orders.sentAt', { time: format.time(o.createdAt) })} · {format.money(o.total)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {held.length > 0 && (
                      <button
                        type="button"
                        onClick={() => fire(o.id)}
                        disabled={busyOrder === o.id}
                        className="h-12 flex-1 rounded-[14px] px-3 text-[15px] font-bold text-white disabled:opacity-60"
                        style={{ background: ACCENT }}
                      >
                        {t('waiter.orders.fire')}
                      </button>
                    )}
                    {ready && (
                      <button type="button" onClick={() => serve(o.id)} disabled={busyOrder === o.id} className="h-12 flex-1 rounded-[14px] bg-[#0f7a3f] px-3 text-[15px] font-bold text-white disabled:opacity-60">
                        {t('waiter.orders.serve')}
                      </button>
                    )}
                    {o.tableId && (
                      <button
                        type="button"
                        onClick={() => startOrder({ tableId: o.tableId!, orderId: o.id, covers: o.covers })}
                        className="h-12 flex-1 rounded-[14px] bg-[#f1efe9] px-3 text-[15px] font-bold"
                      >
                        {t('waiter.orders.addMore')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ═════════ Navigation ═════════ */}
      {(screen === 'floor' || screen === 'orders') && (
        <nav aria-label="Navigation" className={cn('grid border-t border-[#e7e5df] bg-white px-2 pb-3.5 pt-1.5', pinSession ? 'grid-cols-2' : 'grid-cols-3')}>
          {[
            { id: 'floor' as const, label: t('waiter.nav.floor'), Icon: LayoutGrid },
            { id: 'orders' as const, label: t('waiter.nav.orders'), Icon: ClipboardList },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={screen === id ? 'page' : undefined}
              onClick={() => {
                setScreen(id);
                refresh();
              }}
              className="relative flex h-14 flex-col items-center justify-center gap-1 text-[13px] font-bold"
              style={{ color: screen === id ? ACCENT : '#5b5e66' }}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
              {id === 'orders' && readyCount > 0 && (
                <span className="absolute left-[56%] top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0f7a3f] px-1.5 text-xs text-white">
                  {readyCount}
                </span>
              )}
            </button>
          ))}
          {!pinSession && (
            <Link href="/dashboard" className="flex h-14 flex-col items-center justify-center gap-1 text-[13px] font-bold text-[#5b5e66]">
              <LayoutDashboard className="h-5 w-5" aria-hidden />
              <span className="max-w-full truncate px-1">{t('nav.dashboard')}</span>
            </Link>
          )}
        </nav>
      )}

      {/* ═════════ Couverts (table libre) ═════════ */}
      {coversFor && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#17181c]/45" onClick={() => setCoversFor(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="covers-title"
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-md flex-col gap-4 rounded-t-3xl bg-white px-5 pb-7 pt-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="covers-title" className="text-lg font-extrabold">
                {t('waiter.covers.title', { table: coversFor.table.name })}
              </h2>
              <button type="button" onClick={() => setCoversFor(null)} aria-label={t('waiter.covers.close')} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1efe9]">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {Array.from({ length: Math.max(1, coversFor.max) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={t(n > 1 ? 'waiter.covers.other' : 'waiter.covers.one', { count: n })}
                  onClick={() => {
                    const { table } = coversFor;
                    setCoversFor(null);
                    startOrder({ tableId: table.id, orderId: null, covers: n });
                  }}
                  className="h-16 rounded-2xl bg-[#f1efe9] text-[22px] font-extrabold"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═════════ Fiche de table : groupes en cours ═════════ */}
      {tableSheet && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#17181c]/45" onClick={() => setTableSheet(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="table-title"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80dvh] w-full max-w-md flex-col gap-3 rounded-t-3xl bg-white px-5 pb-6 pt-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="table-title" className="text-lg font-extrabold">
                  {tableSheet.name}
                </h2>
                {tableSheet.capacity > 0 && (
                  <p className="text-sm text-[#5b5e66]">
                    {t('waiter.floor.seats', { taken: tableSheet.capacity - seatsFreeWithQueue(tableSheet), capacity: tableSheet.capacity })}
                    {tableSheet.groups.length ? ` · ${t(`waiter.floor.${tableState(tableSheet)}`)}` : ''}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setTableSheet(null)} aria-label={t('waiter.covers.close')} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1efe9]">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto">
              {tableSheet.groups.map((g, i) => (
                <button
                  key={g.orderId}
                  type="button"
                  onClick={() => {
                    const table = tableSheet;
                    setTableSheet(null);
                    startOrder({ tableId: table.id, orderId: g.orderId, covers: g.covers });
                  }}
                  className={cn('flex min-h-16 items-center justify-between gap-3 rounded-2xl border-2 px-4 py-2 text-left', g.status === 'READY' ? 'border-[#0f7a3f] bg-[#ecfdf3]' : 'border-[#e7e5df]')}
                >
                  <span>
                    <span className="block font-bold">
                      {t('waiter.table.group', { n: i + 1 })}
                      {g.covers ? ` · ${t('waiter.order.coversSub', { count: g.covers })}` : ''}
                    </span>
                    <span className="block text-sm text-[#5b5e66]">
                      {[g.mine ? t('waiter.floor.you') : g.waiterName, t(`waiter.orders.status.${g.status as 'PENDING'}`), format.money(g.total)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-[#5b21b6]">{t('waiter.orders.addMore')}</span>
                </button>
              ))}
              {queuedGroups(tableSheet.id).map((q) => (
                <button
                  key={q.ref}
                  type="button"
                  onClick={() => {
                    const table = tableSheet;
                    setTableSheet(null);
                    startOrder({ tableId: table.id, orderId: null, covers: q.payload.covers ?? null, queuedRef: q.ref });
                  }}
                  className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-[#d9a441] px-4 py-2 text-left"
                >
                  <span>
                    <span className="block font-bold">
                      {t('waiter.offline.queuedGroup')}
                      {q.payload.covers ? ` · ${t('waiter.order.coversSub', { count: q.payload.covers })}` : ''}
                    </span>
                    <span className="block text-sm text-[#5b5e66]">{t('waiter.offline.waiting')}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-[#5b21b6]">{t('waiter.orders.addMore')}</span>
                </button>
              ))}
            </div>
            {tableSheet.capacity === 0 || seatsFreeWithQueue(tableSheet) > 0 ? (
              <button
                type="button"
                onClick={() => {
                  const table = tableSheet;
                  setTableSheet(null);
                  setCoversFor({ table, max: table.capacity ? seatsFreeWithQueue(table) : 8 });
                }}
                className="mt-1 h-14 rounded-[18px] text-base font-extrabold text-white"
                style={{ background: ACCENT }}
              >
                {t('waiter.table.newGroup')}
                {tableSheet.capacity > 0 ? ` · ${t('waiter.table.freeSeats', { count: seatsFreeWithQueue(tableSheet) })}` : ''}
              </button>
            ) : (
              <p className="rounded-xl bg-[#f1efe9] px-4 py-3 text-center text-sm font-semibold text-[#3d4048]">{t('waiter.table.full')}</p>
            )}
          </div>
        </div>
      )}

      {/* ═════════ Accompagnements ═════════ */}
      {accSheet &&
        (() => {
          const p = productById.get(accSheet.productId);
          if (!p) return null;
          return (
            <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#17181c]/45" onClick={() => setAccSheet(null)}>
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="acc-title"
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[80dvh] w-full max-w-md flex-col gap-3 rounded-t-3xl bg-white px-5 pb-6 pt-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 id="acc-title" className="text-lg font-extrabold">
                    {t('waiter.accompaniments.title', { name: p.name })}
                  </h2>
                  <button type="button" onClick={() => setAccSheet(null)} aria-label={t('waiter.covers.close')} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1efe9]">
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                </div>
                <p className="text-sm text-[#5b5e66]">{t('waiter.accompaniments.hint')}</p>
                <div className="flex flex-col gap-2 overflow-y-auto">
                  {p.accompaniments.map((a) => {
                    const on = accSheet.selected.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setAccSheet({ ...accSheet, selected: on ? accSheet.selected.filter((x) => x !== a.id) : [...accSheet.selected, a.id] })}
                        className={cn('flex min-h-14 items-center justify-between rounded-2xl border-2 px-4 text-left font-bold', on ? 'bg-[#f5f3ff]' : 'border-[#e7e5df]')}
                        style={on ? { borderColor: ACCENT } : undefined}
                      >
                        <span>{a.quantity > 1 ? `${a.quantity} × ${a.name}` : a.name}</span>
                        <span className="text-sm font-semibold text-[#5b5e66]">{a.price > 0 ? `+ ${format.money(a.price * a.quantity)}` : ''}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    addLine(p.id, accSheet.selected);
                    setAccSheet(null);
                  }}
                  className="mt-1 h-14 rounded-[18px] text-base font-extrabold text-white"
                  style={{ background: ACCENT }}
                >
                  {accSheet.selected.length ? t('waiter.accompaniments.confirm') : t('waiter.accompaniments.none')}
                </button>
              </div>
            </div>
          );
        })()}

      {/* Raccourci vers une commande prête quand on est ailleurs */}
      {readyCount > 0 && screen !== 'orders' && screen !== 'floor' && (
        <button
          type="button"
          onClick={() => setScreen('orders')}
          className="fixed right-3 top-3 z-30 flex h-11 items-center gap-1.5 rounded-full bg-[#0f7a3f] px-3.5 text-sm font-bold text-white shadow-lg"
        >
          <Bell className="h-4 w-4" aria-hidden /> {readyCount}
        </button>
      )}
    </div>
  );
}
