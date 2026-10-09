-- ============================================================
-- SHEDE ERP — Phase 21 : statistiques des listes paginées
-- Les listes ne chargent plus que 20 lignes par page ; les chiffres affichés
-- au-dessus (totaux, répartitions) sont calculés ici, sur toutes les données.
-- À exécuter dans le SQL Editor de votre projet Supabase.
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
-- ============================================================

-- Commandes d'un point : nombre et montant, au total et par statut.
CREATE OR REPLACE FUNCTION order_list_stats(p_structure_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', jsonb_build_object('count', COUNT(*), 'revenue', COALESCE(SUM(total), 0)),
    'byStatus', COALESCE((
      SELECT jsonb_object_agg(status, jsonb_build_object('count', n, 'revenue', amount))
      FROM (
        SELECT status, COUNT(*) AS n, COALESCE(SUM(total), 0) AS amount
        FROM orders WHERE structure_id = p_structure_id GROUP BY status
      ) s
    ), '{}'::jsonb)
  )
  FROM orders
  WHERE structure_id = p_structure_id;
$$;
REVOKE ALL ON FUNCTION order_list_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION order_list_stats(UUID) TO service_role;

-- Produits d'un point (hors supprimés) : total, disponibles, indisponibles, catégories utilisées.
CREATE OR REPLACE FUNCTION product_list_stats(p_structure_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'available', COUNT(*) FILTER (WHERE p.is_available),
    'unavailable', COUNT(*) FILTER (WHERE NOT p.is_available),
    'categories', (
      SELECT COUNT(DISTINCT l.category_id)
      FROM product_category_links l
      JOIN products lp ON lp.id = l.product_id
      WHERE lp.structure_id = p_structure_id AND lp.is_deleted = false
    )
  )
  FROM products p
  WHERE p.structure_id = p_structure_id AND p.is_deleted = false;
$$;
REVOKE ALL ON FUNCTION product_list_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION product_list_stats(UUID) TO service_role;

-- Équipe d'un point : total, administrateurs, réception, autres membres.
CREATE OR REPLACE FUNCTION user_list_stats(p_structure_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'admins', COUNT(*) FILTER (WHERE role = 'ADMIN'),
    'reception', COUNT(*) FILTER (WHERE role = 'RECEPTION'),
    'staff', COUNT(*) FILTER (WHERE role NOT IN ('ADMIN', 'RECEPTION'))
  )
  FROM users
  WHERE structure_id = p_structure_id;
$$;
REVOKE ALL ON FUNCTION user_list_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION user_list_stats(UUID) TO service_role;

-- Promotions d'un point : total, actives, en pourcentage, à montant fixe.
CREATE OR REPLACE FUNCTION promotion_list_stats(p_structure_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'active', COUNT(*) FILTER (WHERE is_active),
    'percentage', COUNT(*) FILTER (WHERE type = 'PERCENTAGE'),
    'fixed', COUNT(*) FILTER (WHERE type = 'FIXED')
  )
  FROM promotions
  WHERE structure_id = p_structure_id;
$$;
REVOKE ALL ON FUNCTION promotion_list_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION promotion_list_stats(UUID) TO service_role;

-- Chambres d'un point : total et répartition par état.
CREATE OR REPLACE FUNCTION room_list_stats(p_structure_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'available', COUNT(*) FILTER (WHERE status = 'AVAILABLE'),
    'occupied', COUNT(*) FILTER (WHERE status = 'OCCUPIED'),
    'cleaning', COUNT(*) FILTER (WHERE status = 'CLEANING')
  )
  FROM rooms
  WHERE structure_id = p_structure_id;
$$;
REVOKE ALL ON FUNCTION room_list_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION room_list_stats(UUID) TO service_role;

-- Réservations des chambres d'un point : nombre et montant, au total et par statut.
CREATE OR REPLACE FUNCTION booking_list_stats(p_structure_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH b AS (
    SELECT bk.status, COALESCE(bk.total_amount, 0) AS amount
    FROM bookings bk
    JOIN rooms r ON r.id = bk.room_id
    WHERE r.structure_id = p_structure_id
  )
  SELECT jsonb_build_object(
    'total', jsonb_build_object('count', (SELECT COUNT(*) FROM b), 'revenue', (SELECT COALESCE(SUM(amount), 0) FROM b)),
    'byStatus', COALESCE((
      SELECT jsonb_object_agg(status, jsonb_build_object('count', n, 'revenue', amount))
      FROM (SELECT status, COUNT(*) AS n, SUM(amount) AS amount FROM b GROUP BY status) s
    ), '{}'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION booking_list_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION booking_list_stats(UUID) TO service_role;

-- Fichier clients d'un point : total et nouveaux clients du mois en cours (heure du Cameroun).
CREATE OR REPLACE FUNCTION client_list_stats(p_structure_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'newThisMonth', COUNT(*) FILTER (
      WHERE created_at >= (date_trunc('month', NOW() AT TIME ZONE 'Africa/Douala') AT TIME ZONE 'Africa/Douala')
    )
  )
  FROM clients
  WHERE structure_id = p_structure_id;
$$;
REVOKE ALL ON FUNCTION client_list_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION client_list_stats(UUID) TO service_role;

-- Mouvements de stock d'un point : total et répartition entrées / sorties / ajustements.
CREATE OR REPLACE FUNCTION stock_movement_list_stats(p_structure_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'in', COUNT(*) FILTER (WHERE type = 'IN'),
    'out', COUNT(*) FILTER (WHERE type = 'OUT'),
    'adjustment', COUNT(*) FILTER (WHERE type = 'ADJUSTMENT')
  )
  FROM stock_movements
  WHERE structure_id = p_structure_id;
$$;
REVOKE ALL ON FUNCTION stock_movement_list_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION stock_movement_list_stats(UUID) TO service_role;

CREATE INDEX IF NOT EXISTS idx_stock_movements_structure_created ON stock_movements (structure_id, created_at DESC);

-- Sessions de caisse d'un point : total, écarts négatifs, sessions ouvertes.
CREATE OR REPLACE FUNCTION shift_list_stats(p_structure_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'negative', COUNT(*) FILTER (WHERE difference < 0),
    'open', COUNT(*) FILTER (WHERE status = 'OPEN')
  )
  FROM shifts
  WHERE structure_id = p_structure_id;
$$;
REVOKE ALL ON FUNCTION shift_list_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION shift_list_stats(UUID) TO service_role;

-- Bons de commande d'un point : nombre et montant HT, au total et par statut.
CREATE OR REPLACE FUNCTION purchase_order_list_stats(p_structure_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', jsonb_build_object('count', COUNT(*), 'amount', COALESCE(SUM(total_ht), 0)),
    'byStatus', COALESCE((
      SELECT jsonb_object_agg(status, jsonb_build_object('count', n, 'amount', amount))
      FROM (
        SELECT status, COUNT(*) AS n, COALESCE(SUM(total_ht), 0) AS amount
        FROM purchase_orders WHERE structure_id = p_structure_id GROUP BY status
      ) s
    ), '{}'::jsonb)
  )
  FROM purchase_orders
  WHERE structure_id = p_structure_id;
$$;
REVOKE ALL ON FUNCTION purchase_order_list_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION purchase_order_list_stats(UUID) TO service_role;

-- Réceptions d'un point sur une période : nombre, montant HT, réceptions sans bon de commande, non comptabilisées.
CREATE OR REPLACE FUNCTION receipt_list_stats(p_structure_id UUID, p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'count', COUNT(*),
    'amount', COALESCE(SUM(total_ht), 0),
    'direct', COUNT(*) FILTER (WHERE purchase_order_id IS NULL),
    'unaccounted', COUNT(*) FILTER (WHERE COALESCE(array_length(expense_ids, 1), 0) = 0)
  )
  FROM goods_receipts
  WHERE structure_id = p_structure_id AND received_at >= p_from AND received_at < p_to;
$$;
REVOKE ALL ON FUNCTION receipt_list_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION receipt_list_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- Inventaires d'un point : total, validés, et l'inventaire en cours (brouillon) s'il existe.
CREATE OR REPLACE FUNCTION inventory_list_stats(p_structure_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'validated', COUNT(*) FILTER (WHERE status = 'VALIDATED'),
    'varianceValue', COALESCE(SUM(variance_value) FILTER (WHERE status = 'VALIDATED'), 0),
    'draftId', (
      SELECT id FROM inventories
      WHERE structure_id = p_structure_id AND status = 'DRAFT'
      ORDER BY created_at DESC LIMIT 1
    )
  )
  FROM inventories
  WHERE structure_id = p_structure_id;
$$;
REVOKE ALL ON FUNCTION inventory_list_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION inventory_list_stats(UUID) TO service_role;

-- Pertes déclarées d'un point sur une période : nombre, valeur totale et valeur par motif.
CREATE OR REPLACE FUNCTION loss_list_stats(p_structure_id UUID, p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH l AS (
    SELECT COALESCE(loss_reason, 'other') AS reason, ROUND(COALESCE(quantity * unit_cost, 0)) AS value
    FROM stock_movements
    WHERE structure_id = p_structure_id AND reason = 'loss' AND created_at >= p_from AND created_at < p_to
  )
  SELECT jsonb_build_object(
    'count', (SELECT COUNT(*) FROM l),
    'value', (SELECT COALESCE(SUM(value), 0) FROM l),
    'byReason', COALESCE((SELECT jsonb_object_agg(reason, v) FROM (SELECT reason, SUM(value) AS v FROM l GROUP BY reason) s), '{}'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION loss_list_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION loss_list_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- Ingrédients d'un point : total, actifs, sous le seuil d'alerte, utilisés dans une fiche recette.
CREATE OR REPLACE FUNCTION ingredient_list_stats(p_structure_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'active', COUNT(*) FILTER (WHERE i.is_active),
    'low', COUNT(*) FILTER (WHERE i.is_active AND s.threshold > 0 AND COALESCE(s.quantity, 0) <= s.threshold),
    'inRecipes', COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM recipe_items r WHERE r.ingredient_id = i.id))
  )
  FROM ingredients i
  LEFT JOIN stocks s ON s.ingredient_id = i.id
  WHERE i.structure_id = p_structure_id;
$$;
REVOKE ALL ON FUNCTION ingredient_list_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ingredient_list_stats(UUID) TO service_role;

-- Accompagnements d'un point (hors supprimés) : total, disponibles, somme des prix.
CREATE OR REPLACE FUNCTION accompaniment_list_stats(p_structure_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'available', COUNT(*) FILTER (WHERE is_available),
    'totalPrice', COALESCE(SUM(price), 0)
  )
  FROM accompaniments
  WHERE structure_id = p_structure_id AND is_deleted = false;
$$;
REVOKE ALL ON FUNCTION accompaniment_list_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION accompaniment_list_stats(UUID) TO service_role;

-- Organisations (super-admin) : total, points, licences actives, licences qui expirent dans les 7 jours.
CREATE OR REPLACE FUNCTION organization_list_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM organizations),
    'points', (SELECT COUNT(*) FROM structures WHERE organization_id IS NOT NULL),
    'active', (SELECT COUNT(DISTINCT organization_id) FROM licenses WHERE is_active = true),
    'expiringSoon', (
      SELECT COUNT(DISTINCT organization_id) FROM licenses
      WHERE expires_at > NOW() AND expires_at <= NOW() + INTERVAL '7 days'
    )
  );
$$;
REVOKE ALL ON FUNCTION organization_list_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION organization_list_stats() TO service_role;

-- Sessions de caisse de plusieurs points (vue propriétaire) : total, ouvertes, écarts négatifs
-- et somme des écarts des sessions clôturées ; p_status optionnel (OPEN / CLOSED).
CREATE OR REPLACE FUNCTION shift_scope_stats(p_structure_ids UUID[], p_status TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'open', COUNT(*) FILTER (WHERE status = 'OPEN'),
    'negative', COUNT(*) FILTER (WHERE status = 'CLOSED' AND difference < 0),
    'totalDifference', COALESCE(SUM(difference) FILTER (WHERE status = 'CLOSED'), 0)
  )
  FROM shifts
  WHERE structure_id = ANY(p_structure_ids) AND (p_status IS NULL OR status = p_status);
$$;
REVOKE ALL ON FUNCTION shift_scope_stats(UUID[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION shift_scope_stats(UUID[], TEXT) TO service_role;

-- Statistiques (page Statistiques) : chiffre d'affaires restaurant et hôtel, répartitions par statut
-- et par moyen de paiement. p_structure_id NULL = toute la plateforme (super-admin) ; p_since NULL = tout.
CREATE OR REPLACE FUNCTION analytics_summary(p_structure_id UUID, p_since TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH o AS (
    SELECT COALESCE(status, 'UNKNOWN') AS status, COALESCE(total, 0) AS total
    FROM orders
    WHERE (p_structure_id IS NULL OR structure_id = p_structure_id)
      AND (p_since IS NULL OR created_at >= p_since)
  ),
  b AS (
    SELECT COALESCE(bk.status, 'UNKNOWN') AS status, bk.is_paid, COALESCE(bk.total_amount, 0) AS amount
    FROM bookings bk
    JOIN rooms r ON r.id = bk.room_id
    WHERE (p_structure_id IS NULL OR r.structure_id = p_structure_id)
      AND (p_since IS NULL OR bk.created_at >= p_since)
  ),
  p AS (
    SELECT COALESCE(pm.payment_method, 'AUTRE') AS method, COALESCE(pm.amount, 0) AS amount
    FROM payments pm
    LEFT JOIN orders po ON po.id = pm.order_id
    WHERE pm.status = 'COMPLETED'
      AND (p_structure_id IS NULL OR po.structure_id = p_structure_id)
      AND (p_since IS NULL OR pm.created_at >= p_since)
  )
  SELECT jsonb_build_object(
    'orderRevenue', (SELECT COALESCE(SUM(total), 0) FROM o WHERE status = 'COMPLETED'),
    'ordersCount', (SELECT COUNT(*) FROM o),
    'completedOrdersCount', (SELECT COUNT(*) FROM o WHERE status = 'COMPLETED'),
    'ordersByStatus', COALESCE((SELECT jsonb_object_agg(status, n) FROM (SELECT status, COUNT(*) AS n FROM o GROUP BY status) s), '{}'::jsonb),
    'hotelRevenue', (SELECT COALESCE(SUM(amount), 0) FROM b WHERE status = 'COMPLETED' OR is_paid),
    'bookingsCount', (SELECT COUNT(*) FROM b),
    'bookingsByStatus', COALESCE((SELECT jsonb_object_agg(status, n) FROM (SELECT status, COUNT(*) AS n FROM b GROUP BY status) s), '{}'::jsonb),
    'paymentsByMethod', COALESCE((SELECT jsonb_object_agg(method, amt) FROM (SELECT method, SUM(amount) AS amt FROM p GROUP BY method) s), '{}'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION analytics_summary(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics_summary(UUID, TIMESTAMPTZ) TO service_role;

-- Tableau de bord d'un point (heure du Cameroun) : chiffre d'affaires du jour, de la semaine
-- (depuis dimanche) et du mois, ticket moyen sur 30 jours, commandes en cours, CA des 7 derniers
-- jours, 5 produits les plus vendus sur 30 jours, articles sous le seuil (8 au plus).
CREATE OR REPLACE FUNCTION dashboard_summary(p_structure_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT (NOW() AT TIME ZONE 'Africa/Douala')::DATE AS today
  ),
  paid AS (
    SELECT o.id, o.total, (o.paid_at AT TIME ZONE 'Africa/Douala')::DATE AS day
    FROM orders o, bounds
    WHERE o.structure_id = p_structure_id
      AND o.status = 'COMPLETED'
      AND o.paid_at >= ((LEAST(bounds.today - 30, date_trunc('month', bounds.today)::DATE))::TIMESTAMP AT TIME ZONE 'Africa/Douala')
  )
  SELECT jsonb_build_object(
    'todayRevenue', (SELECT COALESCE(SUM(total), 0) FROM paid, bounds WHERE day = bounds.today),
    'weekRevenue', (SELECT COALESCE(SUM(total), 0) FROM paid, bounds WHERE day >= bounds.today - EXTRACT(DOW FROM bounds.today)::INT),
    'monthRevenue', (SELECT COALESCE(SUM(total), 0) FROM paid, bounds WHERE day >= date_trunc('month', bounds.today)::DATE),
    'avgOrderValue', (SELECT COALESCE(AVG(total), 0) FROM paid, bounds WHERE day >= bounds.today - 30),
    'pendingCount', (SELECT COUNT(*) FROM orders WHERE structure_id = p_structure_id AND status = 'PENDING'),
    'inProgressCount', (SELECT COUNT(*) FROM orders WHERE structure_id = p_structure_id AND status = 'IN_PROGRESS'),
    'dailyRevenue', (
      SELECT jsonb_agg(jsonb_build_object('date', d::DATE, 'revenue', COALESCE((SELECT SUM(total) FROM paid WHERE day = d::DATE), 0)) ORDER BY d)
      FROM bounds, generate_series(bounds.today - 6, bounds.today, INTERVAL '1 day') AS d
    ),
    'topProducts', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.quantity DESC)
      FROM (
        SELECT oi.product_id, MAX(p.name) AS name, SUM(oi.quantity) AS quantity
        FROM order_items oi
        JOIN paid ON paid.id = oi.order_id
        LEFT JOIN products p ON p.id = oi.product_id, bounds
        WHERE paid.day >= bounds.today - 30 AND oi.product_id IS NOT NULL AND oi.parent_order_item_id IS NULL
        GROUP BY oi.product_id
        ORDER BY SUM(oi.quantity) DESC
        LIMIT 5
      ) t
    ), '[]'::jsonb),
    'lowStock', COALESCE((
      SELECT jsonb_agg(l)
      FROM (
        SELECT s.id, COALESCE(p.name, a.name, '—') AS name, s.quantity, COALESCE(s.threshold, 5) AS threshold,
               CASE WHEN s.accompaniment_id IS NOT NULL THEN 'accompaniment' ELSE 'product' END AS type
        FROM stocks s
        LEFT JOIN products p ON p.id = s.product_id
        LEFT JOIN accompaniments a ON a.id = s.accompaniment_id
        WHERE s.structure_id = p_structure_id
          AND (s.product_id IS NOT NULL OR s.accompaniment_id IS NOT NULL)
          AND s.quantity <= COALESCE(s.threshold, 5)
        ORDER BY s.quantity - COALESCE(s.threshold, 5)
        LIMIT 8
      ) l
    ), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION dashboard_summary(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION dashboard_summary(UUID) TO service_role;
CREATE INDEX IF NOT EXISTS idx_orders_structure_status_paid ON orders (structure_id, status, paid_at);

-- Dépenses d'un point sur une période (filtre de statut optionnel) : nombre et montant TTC des
-- dépenses non annulées, et dettes fournisseurs non réglées toutes périodes confondues.
CREATE OR REPLACE FUNCTION expense_list_stats(p_structure_id UUID, p_from DATE, p_to DATE, p_status TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'count', COUNT(*) FILTER (WHERE status <> 'CANCELLED'),
    'total', COALESCE(SUM(amount_ttc) FILTER (WHERE status <> 'CANCELLED'), 0),
    'unpaidTotal', (SELECT COALESCE(SUM(amount_ttc), 0) FROM expenses WHERE structure_id = p_structure_id AND status = 'UNPAID')
  )
  FROM expenses
  WHERE structure_id = p_structure_id
    AND expense_date >= p_from AND expense_date <= p_to
    AND (p_status IS NULL OR status = p_status);
$$;
REVOKE ALL ON FUNCTION expense_list_stats(UUID, DATE, DATE, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION expense_list_stats(UUID, DATE, DATE, TEXT) TO service_role;
