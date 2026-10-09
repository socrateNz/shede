-- Schéma de départ de la base locale : copie de la structure du projet Supabase (docs/phase1 → phase21).

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: accompaniment_list_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accompaniment_list_stats(p_structure_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'available', COUNT(*) FILTER (WHERE is_available),
    'totalPrice', COALESCE(SUM(price), 0)
  )
  FROM accompaniments
  WHERE structure_id = p_structure_id AND is_deleted = false;
$$;


--
-- Name: analytics_summary(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.analytics_summary(p_structure_id uuid, p_since timestamp with time zone) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: api_count_order(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.api_count_order(p_structure_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_month DATE := date_trunc('month', NOW())::DATE;
  v_org UUID;
  v_quota INTEGER;
  v_used INTEGER;
BEGIN
  SELECT s.organization_id, l.api_monthly_orders INTO v_org, v_quota
  FROM structures s
  LEFT JOIN licenses l ON l.organization_id = s.organization_id
  WHERE s.id = p_structure_id;

  -- Verrou sur l'organisation : deux commandes simultanées ne dépassent pas le quota.
  PERFORM 1 FROM organizations WHERE id = v_org FOR UPDATE;

  IF v_quota IS NOT NULL THEN
    SELECT COALESCE(SUM(u.orders), 0) INTO v_used
    FROM api_usage u JOIN structures s ON s.id = u.structure_id
    WHERE s.organization_id = v_org AND u.month = v_month;
    IF v_used >= v_quota THEN
      RETURN FALSE;
    END IF;
  END IF;

  INSERT INTO api_usage (structure_id, month, orders)
  VALUES (p_structure_id, v_month, 1)
  ON CONFLICT (structure_id, month) DO UPDATE SET orders = api_usage.orders + 1;
  RETURN TRUE;
END;
$$;


--
-- Name: api_hit(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.api_hit(p_structure_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_window TIMESTAMPTZ := date_trunc('minute', NOW());
  v_hits INTEGER;
BEGIN
  INSERT INTO api_rate_windows (structure_id, window_start, hits)
  VALUES (p_structure_id, v_window, 1)
  ON CONFLICT (structure_id, window_start)
  DO UPDATE SET hits = api_rate_windows.hits + 1
  RETURNING hits INTO v_hits;

  INSERT INTO api_usage (structure_id, month, requests)
  VALUES (p_structure_id, date_trunc('month', NOW())::DATE, 1)
  ON CONFLICT (structure_id, month)
  DO UPDATE SET requests = api_usage.requests + 1;

  -- Ménage : les fenêtres de plus d'une heure ne servent plus.
  IF v_hits = 1 THEN
    DELETE FROM api_rate_windows
    WHERE structure_id = p_structure_id AND window_start < NOW() - INTERVAL '1 hour';
  END IF;

  RETURN v_hits;
END;
$$;


--
-- Name: assign_invoice_number(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_invoice_number(p_kind text, p_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_structure_id UUID;
  v_existing TEXT;
  v_counter INTEGER;
  v_number TEXT;
BEGIN
  IF p_kind = 'ORDER' THEN
    SELECT structure_id, invoice_number INTO v_structure_id, v_existing
    FROM orders WHERE id = p_id FOR UPDATE;
  ELSIF p_kind = 'BOOKING' THEN
    SELECT r.structure_id, b.invoice_number INTO v_structure_id, v_existing
    FROM bookings b JOIN rooms r ON r.id = b.room_id
    WHERE b.id = p_id FOR UPDATE OF b;
  ELSE
    RAISE EXCEPTION 'assign_invoice_number: type inconnu %', p_kind;
  END IF;

  IF v_structure_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  UPDATE structures
  SET invoice_counter = invoice_counter + 1
  WHERE id = v_structure_id
  RETURNING invoice_counter INTO v_counter;

  v_number := to_char(NOW(), 'YYYY') || '-' || lpad(v_counter::TEXT, 6, '0');

  IF p_kind = 'ORDER' THEN
    UPDATE orders SET invoice_number = v_number WHERE id = p_id;
  ELSE
    UPDATE bookings SET invoice_number = v_number WHERE id = p_id;
  END IF;

  RETURN v_number;
END;
$$;


--
-- Name: booking_list_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.booking_list_stats(p_structure_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: check_ingredient_unit_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_ingredient_unit_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.unit <> OLD.unit AND EXISTS (SELECT 1 FROM recipe_items WHERE ingredient_id = NEW.id) THEN
    RAISE EXCEPTION 'ingredient_unit_in_use' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


--
-- Name: check_product_category_parent(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_product_category_parent() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  parent RECORD;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'category_parent_invalid' USING ERRCODE = 'check_violation';
  END IF;

  -- Verrou sur le parent : deux déplacements simultanés ne peuvent pas créer un 3e niveau.
  SELECT structure_id, parent_id INTO parent
  FROM product_categories
  WHERE id = NEW.parent_id
  FOR UPDATE;

  IF NOT FOUND OR parent.structure_id <> NEW.structure_id OR parent.parent_id IS NOT NULL THEN
    -- Parent introuvable, d'un autre point, ou lui-même sous-catégorie
    RAISE EXCEPTION 'category_parent_invalid' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM product_categories WHERE parent_id = NEW.id) THEN
    -- Une catégorie qui a des sous-catégories ne peut pas devenir sous-catégorie
    RAISE EXCEPTION 'category_has_children' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: check_recipe_item(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_recipe_item() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  ing RECORD;
BEGIN
  SELECT structure_id, unit INTO ing FROM ingredients WHERE id = NEW.ingredient_id;
  IF NOT FOUND OR ing.structure_id <> NEW.structure_id THEN
    RAISE EXCEPTION 'recipe_ingredient_invalid' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT (
    (ing.unit = 'kg' AND NEW.unit IN ('kg', 'g')) OR
    (ing.unit = 'l' AND NEW.unit IN ('l', 'ml')) OR
    (ing.unit = 'piece' AND NEW.unit = 'piece')
  ) THEN
    RAISE EXCEPTION 'recipe_unit_mismatch' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: webhook_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    payload jsonb NOT NULL,
    status character varying(12) DEFAULT 'PENDING'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    last_status_code integer,
    last_error text,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT webhook_deliveries_status_check CHECK (((status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('DELIVERED'::character varying)::text, ('FAILED'::character varying)::text])))
);


--
-- Name: claim_due_webhooks(integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_due_webhooks(p_limit integer, p_structure_id uuid DEFAULT NULL::uuid) RETURNS SETOF public.webhook_deliveries
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  UPDATE webhook_deliveries d
  SET next_attempt_at = NOW() + INTERVAL '2 minutes'
  WHERE d.id IN (
    SELECT w.id FROM webhook_deliveries w
    WHERE w.status = 'PENDING'
      AND w.next_attempt_at <= NOW()
      AND (p_structure_id IS NULL OR w.structure_id = p_structure_id)
    ORDER BY w.created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING d.*;
END;
$$;


--
-- Name: client_list_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.client_list_stats(p_structure_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: daily_product_sales(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.daily_product_sales(p_structure_id uuid, p_from date, p_to date) RETURNS TABLE(day date, product_id uuid, quantity numeric, revenue numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT (o.created_at AT TIME ZONE 'Africa/Douala')::DATE AS day,
         oi.product_id,
         SUM(oi.quantity)::NUMERIC AS quantity,
         SUM(oi.total_price)::NUMERIC AS revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.structure_id = p_structure_id
    AND o.status <> 'CANCELLED'
    AND oi.parent_order_item_id IS NULL
    AND oi.product_id IS NOT NULL
    AND o.created_at >= (p_from::TIMESTAMP AT TIME ZONE 'Africa/Douala')
    AND o.created_at < ((p_to + 1)::TIMESTAMP AT TIME ZONE 'Africa/Douala')
  GROUP BY 1, 2;
$$;


--
-- Name: dashboard_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dashboard_summary(p_structure_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: expense_list_stats(uuid, date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expense_list_stats(p_structure_id uuid, p_from date, p_to date, p_status text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: hourly_sales_profile(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hourly_sales_profile(p_structure_id uuid, p_from date, p_to date) RETURNS TABLE(hour integer, quantity numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Africa/Douala'))::INTEGER AS hour,
         SUM(oi.quantity)::NUMERIC AS quantity
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.structure_id = p_structure_id
    AND o.status <> 'CANCELLED'
    AND oi.parent_order_item_id IS NULL
    AND o.created_at >= (p_from::TIMESTAMP AT TIME ZONE 'Africa/Douala')
    AND o.created_at < ((p_to + 1)::TIMESTAMP AT TIME ZONE 'Africa/Douala')
  GROUP BY 1;
$$;


--
-- Name: ingredient_list_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ingredient_list_stats(p_structure_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: inventory_list_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_list_stats(p_structure_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: is_organization_license_active(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_organization_license_active(p_organization_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.licenses l
    WHERE l.organization_id = p_organization_id
      AND l.is_active IS TRUE
      AND (l.expires_at IS NULL OR l.expires_at > NOW())
  );
$$;


--
-- Name: is_structure_license_active(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_structure_license_active(p_structure_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.structures s
    WHERE s.id = p_structure_id
      AND s.is_active IS NOT FALSE
      AND public.is_organization_license_active(s.organization_id)
  );
$$;


--
-- Name: lock_closed_inventory_lines(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_closed_inventory_lines() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  current_status VARCHAR(12);
BEGIN
  SELECT status INTO current_status FROM inventories WHERE id = NEW.inventory_id;
  -- La validation elle-même fige attendu et coût : autorisée tant que le statut est DRAFT.
  IF current_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'inventory_closed' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: loss_list_stats(uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.loss_list_stats(p_structure_id uuid, p_from timestamp with time zone, p_to timestamp with time zone) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: next_purchase_number(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_purchase_number(p_structure_id uuid, p_kind text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  y INTEGER := EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'Africa/Douala'))::INTEGER;
  n INTEGER;
BEGIN
  INSERT INTO purchase_counters (structure_id, kind, year, last_value)
  VALUES (p_structure_id, p_kind, y, 1)
  ON CONFLICT (structure_id, kind, year) DO UPDATE SET last_value = purchase_counters.last_value + 1
  RETURNING last_value INTO n;
  RETURN p_kind || '-' || y || '-' || LPAD(n::TEXT, 4, '0');
END;
$$;


--
-- Name: order_list_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.order_list_stats(p_structure_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: organization_list_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.organization_list_stats() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: post_accounting_entry(uuid, text, date, text, text, text, uuid, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_accounting_entry(p_structure_id uuid, p_journal text, p_entry_date date, p_label text, p_reference text, p_source_type text, p_source_id uuid, p_reversal_of uuid, p_created_by uuid, p_lines jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_locked DATE;
  v_existing UUID;
  v_debit NUMERIC;
  v_credit NUMERIC;
  v_count INTEGER;
  v_invalid INTEGER;
  v_year INTEGER := EXTRACT(YEAR FROM p_entry_date)::INTEGER;
  v_counter INTEGER;
  v_number TEXT;
  v_entry_id UUID;
BEGIN
  -- Verrou sur le point : sérialise les écritures du point (numérotation
  -- continue, pas de doublon pour un même document).
  SELECT accounting_locked_until INTO v_locked
  FROM structures WHERE id = p_structure_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCOUNTING_INVALID_LINES: point inconnu';
  END IF;

  IF p_source_id IS NOT NULL THEN
    SELECT id INTO v_existing FROM accounting_entries
    WHERE source_type = p_source_type AND source_id = p_source_id;
    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  IF v_locked IS NOT NULL AND p_entry_date <= v_locked THEN
    RAISE EXCEPTION 'ACCOUNTING_PERIOD_LOCKED: période clôturée jusqu''au %', v_locked;
  END IF;

  SELECT
    COUNT(*),
    COALESCE(SUM(ROUND(COALESCE((l->>'debit')::NUMERIC, 0), 2)), 0),
    COALESCE(SUM(ROUND(COALESCE((l->>'credit')::NUMERIC, 0), 2)), 0),
    COUNT(*) FILTER (
      WHERE COALESCE(l->>'account', '') !~ '^[1-8][0-9]{1,11}$'
         OR COALESCE((l->>'debit')::NUMERIC, 0) < 0
         OR COALESCE((l->>'credit')::NUMERIC, 0) < 0
         OR (COALESCE((l->>'debit')::NUMERIC, 0) > 0 AND COALESCE((l->>'credit')::NUMERIC, 0) > 0)
         OR (COALESCE((l->>'debit')::NUMERIC, 0) = 0 AND COALESCE((l->>'credit')::NUMERIC, 0) = 0)
    )
  INTO v_count, v_debit, v_credit, v_invalid
  FROM jsonb_array_elements(p_lines) AS l;

  IF v_count < 2 OR v_invalid > 0 THEN
    RAISE EXCEPTION 'ACCOUNTING_INVALID_LINES: lignes invalides';
  END IF;
  IF v_debit <> v_credit OR v_debit = 0 THEN
    RAISE EXCEPTION 'ACCOUNTING_UNBALANCED: débit % ≠ crédit %', v_debit, v_credit;
  END IF;

  INSERT INTO accounting_counters (structure_id, journal, year, last_number)
  VALUES (p_structure_id, p_journal, v_year, 1)
  ON CONFLICT (structure_id, journal, year)
  DO UPDATE SET last_number = accounting_counters.last_number + 1
  RETURNING last_number INTO v_counter;

  v_number := p_journal || '-' || v_year || '-' || lpad(v_counter::TEXT, 5, '0');

  INSERT INTO accounting_entries (
    structure_id, journal, number, entry_date, label, reference,
    source_type, source_id, reversal_of, created_by
  ) VALUES (
    p_structure_id, p_journal, v_number, p_entry_date, p_label, p_reference,
    COALESCE(p_source_type, 'MANUAL'), p_source_id, p_reversal_of, p_created_by
  ) RETURNING id INTO v_entry_id;

  INSERT INTO accounting_lines (
    entry_id, structure_id, journal, entry_date, account, label, debit, credit, supplier_id
  )
  SELECT
    v_entry_id, p_structure_id, p_journal, p_entry_date,
    l->>'account',
    COALESCE(NULLIF(l->>'label', ''), p_label),
    ROUND(COALESCE((l->>'debit')::NUMERIC, 0), 2),
    ROUND(COALESCE((l->>'credit')::NUMERIC, 0), 2),
    NULLIF(l->>'supplier_id', '')::UUID
  FROM jsonb_array_elements(p_lines) AS l;

  RETURN v_entry_id;
END;
$_$;


--
-- Name: product_list_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.product_list_stats(p_structure_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: promotion_list_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.promotion_list_stats(p_structure_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: purchase_order_list_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purchase_order_list_stats(p_structure_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: receipt_list_stats(uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.receipt_list_stats(p_structure_id uuid, p_from timestamp with time zone, p_to timestamp with time zone) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: receive_goods(uuid, uuid, uuid, uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.receive_goods(p_structure_id uuid, p_supplier_id uuid, p_order_id uuid, p_user_id uuid, p_invoice_reference text, p_note text, p_lines jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  po RECORD;
  line JSONB;
  receipt_id UUID;
  receipt_number TEXT;
  ingredient UUID;
  product UUID;
  order_line UUID;
  packs NUMERIC;
  pack NUMERIC;
  price NUMERIC;
  stock_qty NUMERIC;
  unit_cost NUMERIC;
  old_qty NUMERIC;
  old_cost NUMERIC;
  new_cost NUMERIC;
  total NUMERIC := 0;
BEGIN
  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'receipt_empty' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = p_supplier_id AND structure_id = p_structure_id) THEN
    RAISE EXCEPTION 'supplier_invalid' USING ERRCODE = 'check_violation';
  END IF;

  IF p_order_id IS NOT NULL THEN
    SELECT * INTO po FROM purchase_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND OR po.structure_id <> p_structure_id OR po.supplier_id <> p_supplier_id THEN
      RAISE EXCEPTION 'order_invalid' USING ERRCODE = 'check_violation';
    END IF;
    IF po.status IN ('RECEIVED', 'CANCELLED') THEN
      RAISE EXCEPTION 'order_closed' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  receipt_number := next_purchase_number(p_structure_id, 'BR');
  INSERT INTO goods_receipts (structure_id, supplier_id, purchase_order_id, number, invoice_reference, note, received_by)
  VALUES (p_structure_id, p_supplier_id, p_order_id, receipt_number, NULLIF(TRIM(p_invoice_reference), ''), NULLIF(TRIM(p_note), ''), p_user_id)
  RETURNING id INTO receipt_id;

  FOR line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    ingredient := NULLIF(line->>'ingredient_id', '')::UUID;
    product := NULLIF(line->>'product_id', '')::UUID;
    order_line := NULLIF(line->>'order_line_id', '')::UUID;
    packs := (line->>'quantity')::NUMERIC;
    pack := (line->>'pack_size')::NUMERIC;
    price := (line->>'unit_price')::NUMERIC;

    IF (ingredient IS NULL) = (product IS NULL) OR packs IS NULL OR packs <= 0 OR pack IS NULL OR pack <= 0 OR price IS NULL OR price < 0 THEN
      RAISE EXCEPTION 'receipt_line_invalid' USING ERRCODE = 'check_violation';
    END IF;

    stock_qty := packs * pack;
    unit_cost := price / pack;

    IF ingredient IS NOT NULL THEN
      SELECT cost_per_unit INTO old_cost FROM ingredients WHERE id = ingredient AND structure_id = p_structure_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'receipt_line_invalid' USING ERRCODE = 'check_violation'; END IF;
      SELECT quantity INTO old_qty FROM stocks WHERE structure_id = p_structure_id AND ingredient_id = ingredient FOR UPDATE;
    ELSE
      SELECT purchase_cost INTO old_cost FROM products WHERE id = product AND structure_id = p_structure_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'receipt_line_invalid' USING ERRCODE = 'check_violation'; END IF;
      SELECT quantity INTO old_qty FROM stocks WHERE structure_id = p_structure_id AND product_id = product FOR UPDATE;
    END IF;

    -- Coût moyen pondéré : le stock négatif ou nul ne pèse pas ; sans coût connu, le prix reçu.
    old_qty := GREATEST(COALESCE(old_qty, 0), 0);
    IF old_cost IS NULL OR old_qty = 0 THEN
      new_cost := unit_cost;
    ELSE
      new_cost := (old_qty * old_cost + stock_qty * unit_cost) / (old_qty + stock_qty);
    END IF;

    IF ingredient IS NOT NULL THEN
      UPDATE ingredients SET cost_per_unit = ROUND(new_cost, 2) WHERE id = ingredient;
      UPDATE stocks SET quantity = quantity + stock_qty, updated_at = NOW() WHERE structure_id = p_structure_id AND ingredient_id = ingredient;
      IF NOT FOUND THEN
        INSERT INTO stocks (structure_id, ingredient_id, quantity, threshold, updated_at) VALUES (p_structure_id, ingredient, stock_qty, 0, NOW());
      END IF;
    ELSE
      UPDATE products SET purchase_cost = ROUND(new_cost, 2) WHERE id = product;
      UPDATE stocks SET quantity = quantity + stock_qty, updated_at = NOW() WHERE structure_id = p_structure_id AND product_id = product;
      IF NOT FOUND THEN
        INSERT INTO stocks (structure_id, product_id, quantity, threshold, updated_at) VALUES (p_structure_id, product, stock_qty, 5, NOW());
      END IF;
    END IF;

    INSERT INTO stock_movements (structure_id, product_id, ingredient_id, type, quantity, reason, reference_id, user_id, unit_cost)
    VALUES (p_structure_id, product, ingredient, 'IN', stock_qty, 'purchase', receipt_id::TEXT, p_user_id, ROUND(unit_cost, 2));

    IF order_line IS NOT NULL THEN
      UPDATE purchase_order_lines SET received_quantity = received_quantity + packs
      WHERE id = order_line AND purchase_order_id = p_order_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'receipt_line_invalid' USING ERRCODE = 'check_violation'; END IF;
    END IF;

    INSERT INTO goods_receipt_lines (receipt_id, purchase_order_line_id, ingredient_id, product_id, label, pack_label, pack_size, quantity, unit_price)
    VALUES (receipt_id, order_line, ingredient, product, LEFT(COALESCE(line->>'label', '—'), 150), LEFT(COALESCE(line->>'pack_label', '—'), 60), pack, packs, price);

    total := total + packs * price;
  END LOOP;

  UPDATE goods_receipts SET total_ht = ROUND(total, 2) WHERE id = receipt_id;

  IF p_order_id IS NOT NULL THEN
    UPDATE purchase_orders
    SET status = CASE
          WHEN NOT EXISTS (SELECT 1 FROM purchase_order_lines WHERE purchase_order_id = p_order_id AND received_quantity < quantity)
          THEN 'RECEIVED' ELSE 'PARTIAL' END,
        updated_at = NOW()
    WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object('receipt_id', receipt_id, 'number', receipt_number, 'total_ht', ROUND(total, 2));
END;
$$;


--
-- Name: room_list_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.room_list_stats(p_structure_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: shift_list_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shift_list_stats(p_structure_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'negative', COUNT(*) FILTER (WHERE difference < 0),
    'open', COUNT(*) FILTER (WHERE status = 'OPEN')
  )
  FROM shifts
  WHERE structure_id = p_structure_id;
$$;


--
-- Name: shift_scope_stats(uuid[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shift_scope_stats(p_structure_ids uuid[], p_status text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: stock_movement_list_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stock_movement_list_stats(p_structure_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: user_list_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_list_stats(p_structure_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: validate_inventory(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_inventory(p_inventory_id uuid, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  inv RECORD;
  line RECORD;
  item_column TEXT;
  item_id UUID;
  expected NUMERIC;
  cost NUMERIC;
  total NUMERIC := 0;
  lines_count INTEGER := 0;
BEGIN
  SELECT * INTO inv FROM inventories WHERE id = p_inventory_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory_not_found' USING ERRCODE = 'no_data_found';
  END IF;
  IF inv.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'inventory_closed' USING ERRCODE = 'check_violation';
  END IF;

  FOR line IN
    SELECT * FROM inventory_lines WHERE inventory_id = p_inventory_id AND counted_quantity IS NOT NULL
  LOOP
    item_column := line.item_type || '_id';
    item_id := COALESCE(line.ingredient_id, line.product_id, line.accompaniment_id);

    EXECUTE format('SELECT quantity FROM stocks WHERE structure_id = $1 AND %I = $2 FOR UPDATE', item_column)
      INTO expected USING inv.structure_id, item_id;
    expected := COALESCE(expected, 0);

    cost := NULL;
    IF line.item_type = 'ingredient' THEN
      SELECT cost_per_unit INTO cost FROM ingredients WHERE id = item_id;
    ELSIF line.item_type = 'product' THEN
      SELECT purchase_cost INTO cost FROM products WHERE id = item_id;
    END IF;

    UPDATE inventory_lines SET expected_quantity = expected, unit_cost = cost WHERE id = line.id;

    INSERT INTO stock_movements (structure_id, product_id, accompaniment_id, ingredient_id, type, quantity, reason, reference_id, user_id, unit_cost)
    VALUES (inv.structure_id, line.product_id, line.accompaniment_id, line.ingredient_id,
            'ADJUSTMENT', line.counted_quantity, 'inventory', p_inventory_id::TEXT, p_user_id, cost);

    EXECUTE format('UPDATE stocks SET quantity = $1, updated_at = NOW() WHERE structure_id = $2 AND %I = $3', item_column)
      USING line.counted_quantity, inv.structure_id, item_id;
    IF NOT FOUND THEN
      INSERT INTO stocks (structure_id, product_id, accompaniment_id, ingredient_id, quantity, threshold, updated_at)
      VALUES (inv.structure_id, line.product_id, line.accompaniment_id, line.ingredient_id, line.counted_quantity,
              CASE WHEN line.item_type = 'ingredient' THEN 0 ELSE 5 END, NOW());
    END IF;

    total := total + (line.counted_quantity - expected) * COALESCE(cost, 0);
    lines_count := lines_count + 1;
  END LOOP;

  UPDATE inventories
  SET status = 'VALIDATED', validated_by = p_user_id, validated_at = NOW(),
      variance_value = ROUND(total, 2), counted_lines = lines_count
  WHERE id = p_inventory_id;

  RETURN jsonb_build_object('counted_lines', lines_count, 'variance_value', ROUND(total, 2));
END;
$_$;


--
-- Name: accompaniments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accompaniments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    structure_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    price numeric(10,2) NOT NULL,
    is_available boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: accounting_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    number character varying(12) NOT NULL,
    label text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT accounting_accounts_number_check CHECK (((number)::text ~ '^[1-8][0-9]{1,11}$'::text))
);


--
-- Name: accounting_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_counters (
    structure_id uuid NOT NULL,
    journal character varying(4) NOT NULL,
    year integer NOT NULL,
    last_number integer DEFAULT 0 NOT NULL
);


--
-- Name: accounting_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    journal character varying(4) NOT NULL,
    number character varying(30) NOT NULL,
    entry_date date NOT NULL,
    label text NOT NULL,
    reference text,
    source_type character varying(30) DEFAULT 'MANUAL'::character varying NOT NULL,
    source_id uuid,
    reversal_of uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT accounting_entries_journal_check CHECK (((journal)::text = ANY (ARRAY[('VE'::character varying)::text, ('AC'::character varying)::text, ('TR'::character varying)::text, ('OD'::character varying)::text, ('AN'::character varying)::text])))
);


--
-- Name: accounting_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id uuid NOT NULL,
    structure_id uuid NOT NULL,
    journal character varying(4) NOT NULL,
    entry_date date NOT NULL,
    account character varying(12) NOT NULL,
    label text NOT NULL,
    debit numeric(14,2) DEFAULT 0 NOT NULL,
    credit numeric(14,2) DEFAULT 0 NOT NULL,
    supplier_id uuid,
    CONSTRAINT accounting_lines_check CHECK (((debit = (0)::numeric) OR (credit = (0)::numeric))),
    CONSTRAINT accounting_lines_check1 CHECK (((debit > (0)::numeric) OR (credit > (0)::numeric))),
    CONSTRAINT accounting_lines_credit_check CHECK ((credit >= (0)::numeric)),
    CONSTRAINT accounting_lines_debit_check CHECK ((debit >= (0)::numeric))
);


--
-- Name: api_rate_windows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_rate_windows (
    structure_id uuid NOT NULL,
    window_start timestamp with time zone NOT NULL,
    hits integer DEFAULT 0 NOT NULL
);


--
-- Name: api_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_usage (
    structure_id uuid NOT NULL,
    month date NOT NULL,
    requests integer DEFAULT 0 NOT NULL,
    orders integer DEFAULT 0 NOT NULL
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    room_id uuid NOT NULL,
    client_id uuid,
    check_in timestamp without time zone,
    check_out timestamp without time zone,
    status character varying(50) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    phone character varying(50),
    guest_name character varying(100),
    total_amount numeric(10,2) DEFAULT 0,
    is_paid boolean DEFAULT false,
    tax_amount numeric(12,2) DEFAULT 0,
    tax_rate numeric(5,2) DEFAULT 0,
    prices_include_tax boolean DEFAULT true,
    invoice_number character varying(30)
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    structure_id uuid,
    first_name text NOT NULL,
    last_name text NOT NULL,
    phone text,
    email text,
    birthday date,
    allergies text,
    preferences text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: delivery_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    fee numeric(10,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT delivery_zones_fee_check CHECK ((fee >= (0)::numeric))
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    supplier_id uuid,
    category character varying(40) NOT NULL,
    account character varying(12) NOT NULL,
    expense_date date NOT NULL,
    label text NOT NULL,
    reference text,
    amount_ht numeric(14,2) NOT NULL,
    tax_amount numeric(14,2) DEFAULT 0 NOT NULL,
    amount_ttc numeric(14,2) NOT NULL,
    status character varying(12) DEFAULT 'UNPAID'::character varying NOT NULL,
    payment_method character varying(20),
    paid_at date,
    attachment_url text,
    entry_id uuid,
    payment_entry_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expenses_amount_ht_check CHECK ((amount_ht >= (0)::numeric)),
    CONSTRAINT expenses_amount_ttc_check CHECK ((amount_ttc > (0)::numeric)),
    CONSTRAINT expenses_status_check CHECK (((status)::text = ANY (ARRAY[('UNPAID'::character varying)::text, ('PAID'::character varying)::text, ('CANCELLED'::character varying)::text]))),
    CONSTRAINT expenses_tax_amount_check CHECK ((tax_amount >= (0)::numeric))
);


--
-- Name: floors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.floors (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    structure_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: forecast_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forecast_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    event_date date NOT NULL,
    label character varying(120) NOT NULL,
    impact_percent integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT forecast_events_impact_percent_check CHECK (((impact_percent >= '-100'::integer) AND (impact_percent <= 500)))
);


--
-- Name: forecast_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forecast_snapshots (
    structure_id uuid NOT NULL,
    forecast_date date NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric(12,2) NOT NULL,
    revenue numeric(14,2) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: goods_receipt_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipt_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_id uuid NOT NULL,
    purchase_order_line_id uuid,
    ingredient_id uuid,
    product_id uuid,
    label character varying(150) NOT NULL,
    pack_label character varying(60) NOT NULL,
    pack_size numeric(12,3) NOT NULL,
    quantity numeric(12,3) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    CONSTRAINT goods_receipt_lines_pack_size_check CHECK ((pack_size > (0)::numeric)),
    CONSTRAINT goods_receipt_lines_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT goods_receipt_lines_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: goods_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    purchase_order_id uuid,
    number character varying(30) NOT NULL,
    invoice_reference character varying(60),
    note text,
    total_ht numeric(14,2) DEFAULT 0 NOT NULL,
    received_by uuid,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    expense_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL
);


--
-- Name: ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    unit character varying(10) NOT NULL,
    cost_per_unit numeric(12,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ingredients_cost_per_unit_check CHECK ((cost_per_unit >= (0)::numeric)),
    CONSTRAINT ingredients_unit_check CHECK (((unit)::text = ANY (ARRAY[('kg'::character varying)::text, ('l'::character varying)::text, ('piece'::character varying)::text])))
);


--
-- Name: inventories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    status character varying(12) DEFAULT 'DRAFT'::character varying NOT NULL,
    note text,
    started_by uuid,
    validated_by uuid,
    validated_at timestamp with time zone,
    variance_value numeric(14,2),
    counted_lines integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventories_status_check CHECK (((status)::text = ANY (ARRAY[('DRAFT'::character varying)::text, ('VALIDATED'::character varying)::text, ('CANCELLED'::character varying)::text])))
);


--
-- Name: inventory_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_id uuid NOT NULL,
    item_type character varying(15) NOT NULL,
    ingredient_id uuid,
    product_id uuid,
    accompaniment_id uuid,
    counted_quantity numeric(12,3),
    expected_quantity numeric(12,3),
    unit_cost numeric(12,2),
    counted_by uuid,
    counted_at timestamp with time zone,
    CONSTRAINT inventory_lines_counted_quantity_check CHECK (((counted_quantity IS NULL) OR (counted_quantity >= (0)::numeric))),
    CONSTRAINT inventory_lines_item_type_check CHECK (((item_type)::text = ANY (ARRAY[('ingredient'::character varying)::text, ('product'::character varying)::text, ('accompaniment'::character varying)::text]))),
    CONSTRAINT inventory_lines_one_item CHECK (((((item_type)::text = 'ingredient'::text) AND (ingredient_id IS NOT NULL) AND (product_id IS NULL) AND (accompaniment_id IS NULL)) OR (((item_type)::text = 'product'::text) AND (product_id IS NOT NULL) AND (ingredient_id IS NULL) AND (accompaniment_id IS NULL)) OR (((item_type)::text = 'accompaniment'::text) AND (accompaniment_id IS NOT NULL) AND (ingredient_id IS NULL) AND (product_id IS NULL))))
);


--
-- Name: licenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.licenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid,
    license_key character varying(255),
    plan character varying(50) DEFAULT 'FREE'::character varying NOT NULL,
    max_users integer DEFAULT 5,
    max_tables integer DEFAULT 10,
    features jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id uuid,
    max_points integer DEFAULT 1,
    api_monthly_orders integer DEFAULT 500
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    structure_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    body text NOT NULL,
    url text,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: order_accompaniments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_accompaniments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    order_id uuid NOT NULL,
    parent_order_item_id uuid NOT NULL,
    accompaniment_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price_snapshot numeric(10,2) NOT NULL,
    total_price_snapshot numeric(10,2) NOT NULL,
    is_price_counted boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_price_counted boolean DEFAULT true NOT NULL,
    parent_order_item_id uuid
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    user_id uuid,
    table_number integer,
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    subtotal numeric(10,2) DEFAULT 0,
    tax numeric(10,2) DEFAULT 0,
    total numeric(10,2) DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    room_id uuid,
    client_id uuid,
    source character varying(50) DEFAULT 'CAISSE'::character varying,
    phone character varying(50),
    promotion_id uuid,
    discount_amount numeric DEFAULT 0,
    paid_at timestamp with time zone,
    discount_reason text,
    tip_amount numeric(10,2) DEFAULT 0,
    table_id uuid,
    consumption_type character varying(50) DEFAULT 'DINE_IN'::character varying,
    kitchen_status character varying(50) DEFAULT NULL::character varying,
    bar_status character varying(50) DEFAULT NULL::character varying,
    takeaway_fee numeric(10,2) DEFAULT 0,
    external_id character varying(100),
    partner character varying(50),
    customer_name character varying(120),
    acceptance character varying(12),
    accepted_at timestamp with time zone,
    prep_minutes integer,
    rejection_reason text,
    cancel_reason text,
    courier_status character varying(20),
    courier_name character varying(120),
    courier_phone character varying(30),
    api_last_status character varying(30),
    tax_rate numeric(5,2) DEFAULT 0,
    prices_include_tax boolean DEFAULT true,
    invoice_number character varying(30),
    delivery_zone_id uuid,
    delivery_zone_name character varying(120),
    delivery_fee numeric(10,2) DEFAULT 0,
    delivery_city character varying(100),
    delivery_district character varying(120),
    delivery_landmark text,
    delivery_lat double precision,
    delivery_lng double precision,
    delivery_status character varying(20),
    delivery_note text,
    courier_id uuid,
    delivered_at timestamp with time zone,
    manual_discount numeric(10,2) DEFAULT 0 NOT NULL,
    CONSTRAINT orders_delivery_status_check CHECK (((delivery_status)::text = ANY (ARRAY[('TO_ASSIGN'::character varying)::text, ('ASSIGNED'::character varying)::text, ('IN_TRANSIT'::character varying)::text, ('DELIVERED'::character varying)::text, ('FAILED'::character varying)::text])))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20),
    city character varying(100),
    country character varying(100),
    modules text[] DEFAULT ARRAY['POS'::text],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    purpose text DEFAULT 'RESET'::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT password_reset_tokens_purpose_check CHECK ((purpose = ANY (ARRAY['RESET'::text, 'INVITE'::text])))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_method character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    reference character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: point_api_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_api_credentials (
    structure_id uuid NOT NULL,
    key_prefix character varying(20) NOT NULL,
    key_hash character(64) NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    webhook_url text,
    webhook_secret text
);


--
-- Name: point_api_test_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_api_test_credentials (
    structure_id uuid NOT NULL,
    key_prefix character varying(20) NOT NULL,
    key_hash character(64) NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_accompaniments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_accompaniments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    structure_id uuid NOT NULL,
    product_id uuid NOT NULL,
    accompaniment_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: product_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    name character varying(80) NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_id uuid
);


--
-- Name: product_category_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_category_links (
    product_id uuid NOT NULL,
    category_id uuid NOT NULL
);


--
-- Name: product_recipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid,
    product_id uuid,
    ingredient_id uuid,
    quantity numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    category character varying(100),
    is_available boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    destination character varying(50) DEFAULT 'CUISINE'::character varying,
    image_url text,
    is_deliverable boolean DEFAULT true NOT NULL,
    purchase_cost numeric(12,2)
);


--
-- Name: promo_code_usages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_code_usages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promo_code_id uuid NOT NULL,
    user_id uuid NOT NULL,
    used_at timestamp with time zone DEFAULT now()
);


--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    promotion_id uuid NOT NULL,
    usage_limit integer,
    used_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    value numeric NOT NULL,
    scope text NOT NULL,
    product_id uuid,
    min_order_amount numeric DEFAULT 0,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true,
    structure_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    promo_mode text DEFAULT 'STANDARD'::text,
    code_name text,
    usage_limit integer,
    used_count integer DEFAULT 0,
    required_qty integer,
    free_qty integer,
    is_cumulative boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_product_scope CHECK ((((scope = 'PRODUCT'::text) AND (product_id IS NOT NULL)) OR (scope = 'ORDER'::text))),
    CONSTRAINT promotions_promo_mode_check CHECK ((promo_mode = ANY (ARRAY['STANDARD'::text, 'CODE'::text, 'BUY_X_GET_Y'::text]))),
    CONSTRAINT promotions_scope_check CHECK ((scope = ANY (ARRAY['PRODUCT'::text, 'ORDER'::text]))),
    CONSTRAINT promotions_type_check CHECK ((type = ANY (ARRAY['PERCENTAGE'::text, 'FIXED'::text]))),
    CONSTRAINT promotions_value_check CHECK ((value >= (0)::numeric))
);


--
-- Name: purchase_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_counters (
    structure_id uuid NOT NULL,
    kind character varying(4) NOT NULL,
    year integer NOT NULL,
    last_value integer DEFAULT 0 NOT NULL
);


--
-- Name: purchase_order_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    supplier_item_id uuid,
    ingredient_id uuid,
    product_id uuid,
    label character varying(150) NOT NULL,
    pack_label character varying(60) NOT NULL,
    pack_size numeric(12,3) NOT NULL,
    quantity numeric(12,3) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    received_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    CONSTRAINT purchase_order_lines_pack_size_check CHECK ((pack_size > (0)::numeric)),
    CONSTRAINT purchase_order_lines_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT purchase_order_lines_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    number character varying(30) NOT NULL,
    status character varying(10) DEFAULT 'DRAFT'::character varying NOT NULL,
    expected_date date,
    note text,
    total_ht numeric(14,2) DEFAULT 0 NOT NULL,
    created_by uuid,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_orders_status_check CHECK (((status)::text = ANY (ARRAY[('DRAFT'::character varying)::text, ('SENT'::character varying)::text, ('PARTIAL'::character varying)::text, ('RECEIVED'::character varying)::text, ('CANCELLED'::character varying)::text])))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_id uuid NOT NULL,
    structure_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: recipe_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    product_id uuid,
    accompaniment_id uuid,
    ingredient_id uuid NOT NULL,
    quantity numeric(12,4) NOT NULL,
    unit character varying(10) NOT NULL,
    waste_percent numeric(5,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recipe_items_one_owner CHECK (((product_id IS NULL) <> (accompaniment_id IS NULL))),
    CONSTRAINT recipe_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT recipe_items_unit_check CHECK (((unit)::text = ANY (ARRAY[('kg'::character varying)::text, ('g'::character varying)::text, ('l'::character varying)::text, ('ml'::character varying)::text, ('piece'::character varying)::text]))),
    CONSTRAINT recipe_items_waste_percent_check CHECK (((waste_percent >= (0)::numeric) AND (waste_percent < (90)::numeric)))
);


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    structure_id uuid NOT NULL,
    number character varying(50) NOT NULL,
    type character varying(50),
    status character varying(50) DEFAULT 'AVAILABLE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    price numeric(10,2) DEFAULT 0,
    images text[]
);


--
-- Name: shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid,
    user_id uuid,
    opened_at timestamp with time zone DEFAULT now(),
    closed_at timestamp with time zone,
    opening_balance numeric(12,2) DEFAULT 0 NOT NULL,
    expected_amount numeric(12,2) DEFAULT 0,
    actual_amount numeric(12,2),
    difference numeric(12,2),
    notes text,
    status text DEFAULT 'OPEN'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT shifts_status_check CHECK ((status = ANY (ARRAY['OPEN'::text, 'CLOSED'::text])))
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid,
    product_id uuid,
    user_id uuid,
    type character varying(20),
    quantity numeric(12,2) NOT NULL,
    reason text,
    reference_id text,
    created_at timestamp with time zone DEFAULT now(),
    accompaniment_id uuid,
    ingredient_id uuid,
    unit_cost numeric(12,2),
    loss_reason character varying(30),
    note text,
    CONSTRAINT stock_movements_loss_reason_check CHECK (((loss_reason IS NULL) OR ((loss_reason)::text = ANY (ARRAY[('expired'::character varying)::text, ('damaged'::character varying)::text, ('preparation_error'::character varying)::text, ('theft'::character varying)::text, ('staff_meal'::character varying)::text, ('other'::character varying)::text])))),
    CONSTRAINT stock_movements_type_check CHECK (((type)::text = ANY (ARRAY[('IN'::character varying)::text, ('OUT'::character varying)::text, ('ADJUSTMENT'::character varying)::text])))
);


--
-- Name: stocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid,
    product_id uuid,
    quantity numeric(12,2) DEFAULT 0 NOT NULL,
    threshold numeric(12,2) DEFAULT 5 NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    accompaniment_id uuid,
    ingredient_id uuid
);


--
-- Name: structures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.structures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20),
    address text,
    city character varying(100),
    country character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    type character varying(50) DEFAULT 'RESTAURANT'::character varying,
    modules text[] DEFAULT ARRAY['POS'::text],
    currency text DEFAULT 'XOF'::text,
    timezone text DEFAULT 'Africa/Abidjan'::text,
    tax_rate numeric DEFAULT 0,
    logo_url text,
    takeaway_fee numeric(10,2) DEFAULT 0,
    organization_id uuid,
    is_active boolean DEFAULT true,
    accounting_locked_until date,
    api_paused boolean DEFAULT false NOT NULL,
    niu character varying(50),
    rccm character varying(100),
    prices_include_tax boolean DEFAULT true,
    invoice_counter integer DEFAULT 0 NOT NULL
);


--
-- Name: supplier_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    ingredient_id uuid,
    product_id uuid,
    reference character varying(60),
    pack_label character varying(60) NOT NULL,
    pack_size numeric(12,3) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    is_preferred boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT supplier_items_one_item CHECK (((ingredient_id IS NULL) <> (product_id IS NULL))),
    CONSTRAINT supplier_items_pack_size_check CHECK ((pack_size > (0)::numeric)),
    CONSTRAINT supplier_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    name text NOT NULL,
    phone character varying(30),
    email text,
    niu character varying(50),
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    contact_name text,
    delivery_days smallint[] DEFAULT '{}'::smallint[] NOT NULL,
    lead_time_days smallint DEFAULT 1 NOT NULL,
    min_order_amount numeric(12,2) DEFAULT 0 NOT NULL,
    charges_vat boolean DEFAULT true NOT NULL
);


--
-- Name: tables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tables (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    structure_id uuid,
    name text NOT NULL,
    capacity integer DEFAULT 2,
    shape text DEFAULT 'rectangle'::text,
    position_x integer DEFAULT 0,
    position_y integer DEFAULT 0,
    width integer DEFAULT 100,
    height integer DEFAULT 100,
    floor_name text DEFAULT 'Salle principale'::text,
    status text DEFAULT 'AVAILABLE'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    floor_id uuid
);


--
-- Name: user_structures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_structures (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    structure_id uuid NOT NULL,
    role character varying(50) DEFAULT 'ADMIN'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    role character varying(50) DEFAULT 'SERVEUR'::character varying NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id uuid,
    locale character varying(5) DEFAULT 'fr'::character varying NOT NULL,
    CONSTRAINT users_locale_check CHECK (((locale)::text = ANY (ARRAY[('fr'::character varying)::text, ('en'::character varying)::text])))
);


--
-- Name: accompaniments accompaniments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accompaniments
    ADD CONSTRAINT accompaniments_pkey PRIMARY KEY (id);


--
-- Name: accounting_accounts accounting_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_accounts
    ADD CONSTRAINT accounting_accounts_pkey PRIMARY KEY (id);


--
-- Name: accounting_accounts accounting_accounts_structure_id_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_accounts
    ADD CONSTRAINT accounting_accounts_structure_id_number_key UNIQUE (structure_id, number);


--
-- Name: accounting_counters accounting_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_counters
    ADD CONSTRAINT accounting_counters_pkey PRIMARY KEY (structure_id, journal, year);


--
-- Name: accounting_entries accounting_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_entries
    ADD CONSTRAINT accounting_entries_pkey PRIMARY KEY (id);


--
-- Name: accounting_entries accounting_entries_structure_id_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_entries
    ADD CONSTRAINT accounting_entries_structure_id_number_key UNIQUE (structure_id, number);


--
-- Name: accounting_lines accounting_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_lines
    ADD CONSTRAINT accounting_lines_pkey PRIMARY KEY (id);


--
-- Name: api_rate_windows api_rate_windows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_rate_windows
    ADD CONSTRAINT api_rate_windows_pkey PRIMARY KEY (structure_id, window_start);


--
-- Name: api_usage api_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_usage
    ADD CONSTRAINT api_usage_pkey PRIMARY KEY (structure_id, month);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: delivery_zones delivery_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_pkey PRIMARY KEY (id);


--
-- Name: delivery_zones delivery_zones_structure_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_structure_id_name_key UNIQUE (structure_id, name);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: floors floors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.floors
    ADD CONSTRAINT floors_pkey PRIMARY KEY (id);


--
-- Name: forecast_events forecast_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forecast_events
    ADD CONSTRAINT forecast_events_pkey PRIMARY KEY (id);


--
-- Name: forecast_events forecast_events_structure_id_event_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forecast_events
    ADD CONSTRAINT forecast_events_structure_id_event_date_key UNIQUE (structure_id, event_date);


--
-- Name: forecast_snapshots forecast_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forecast_snapshots
    ADD CONSTRAINT forecast_snapshots_pkey PRIMARY KEY (structure_id, forecast_date, product_id);


--
-- Name: goods_receipt_lines goods_receipt_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_lines
    ADD CONSTRAINT goods_receipt_lines_pkey PRIMARY KEY (id);


--
-- Name: goods_receipts goods_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_pkey PRIMARY KEY (id);


--
-- Name: goods_receipts goods_receipts_structure_id_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_structure_id_number_key UNIQUE (structure_id, number);


--
-- Name: ingredients ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_pkey PRIMARY KEY (id);


--
-- Name: inventories inventories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventories
    ADD CONSTRAINT inventories_pkey PRIMARY KEY (id);


--
-- Name: inventory_lines inventory_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_lines
    ADD CONSTRAINT inventory_lines_pkey PRIMARY KEY (id);


--
-- Name: licenses licenses_license_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_license_key_key UNIQUE (license_key);


--
-- Name: licenses licenses_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_organization_id_key UNIQUE (organization_id);


--
-- Name: licenses licenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_pkey PRIMARY KEY (id);


--
-- Name: licenses licenses_structure_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_structure_id_key UNIQUE (structure_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_accompaniments order_accompaniments_order_id_parent_order_item_id_accompan_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_accompaniments
    ADD CONSTRAINT order_accompaniments_order_id_parent_order_item_id_accompan_key UNIQUE (order_id, parent_order_item_id, accompaniment_id);


--
-- Name: order_accompaniments order_accompaniments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_accompaniments
    ADD CONSTRAINT order_accompaniments_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_email_key UNIQUE (email);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: point_api_credentials point_api_credentials_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_api_credentials
    ADD CONSTRAINT point_api_credentials_key_hash_key UNIQUE (key_hash);


--
-- Name: point_api_credentials point_api_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_api_credentials
    ADD CONSTRAINT point_api_credentials_pkey PRIMARY KEY (structure_id);


--
-- Name: point_api_test_credentials point_api_test_credentials_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_api_test_credentials
    ADD CONSTRAINT point_api_test_credentials_key_hash_key UNIQUE (key_hash);


--
-- Name: point_api_test_credentials point_api_test_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_api_test_credentials
    ADD CONSTRAINT point_api_test_credentials_pkey PRIMARY KEY (structure_id);


--
-- Name: product_accompaniments product_accompaniments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_accompaniments
    ADD CONSTRAINT product_accompaniments_pkey PRIMARY KEY (id);


--
-- Name: product_accompaniments product_accompaniments_structure_id_product_id_accompanimen_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_accompaniments
    ADD CONSTRAINT product_accompaniments_structure_id_product_id_accompanimen_key UNIQUE (structure_id, product_id, accompaniment_id);


--
-- Name: product_categories product_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_pkey PRIMARY KEY (id);


--
-- Name: product_category_links product_category_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category_links
    ADD CONSTRAINT product_category_links_pkey PRIMARY KEY (product_id, category_id);


--
-- Name: product_recipes product_recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_recipes
    ADD CONSTRAINT product_recipes_pkey PRIMARY KEY (id);


--
-- Name: product_recipes product_recipes_product_id_ingredient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_recipes
    ADD CONSTRAINT product_recipes_product_id_ingredient_id_key UNIQUE (product_id, ingredient_id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: promo_code_usages promo_code_usages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_usages
    ADD CONSTRAINT promo_code_usages_pkey PRIMARY KEY (id);


--
-- Name: promo_code_usages promo_code_user_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_usages
    ADD CONSTRAINT promo_code_user_unique UNIQUE (promo_code_id, user_id);


--
-- Name: promo_codes promo_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_code_key UNIQUE (code);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: purchase_counters purchase_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_counters
    ADD CONSTRAINT purchase_counters_pkey PRIMARY KEY (structure_id, kind, year);


--
-- Name: purchase_order_lines purchase_order_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_structure_id_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_structure_id_number_key UNIQUE (structure_id, number);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: recipe_items recipe_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stocks stocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocks
    ADD CONSTRAINT stocks_pkey PRIMARY KEY (id);


--
-- Name: structures structures_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.structures
    ADD CONSTRAINT structures_email_key UNIQUE (email);


--
-- Name: structures structures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.structures
    ADD CONSTRAINT structures_pkey PRIMARY KEY (id);


--
-- Name: supplier_items supplier_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_items
    ADD CONSTRAINT supplier_items_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: tables tables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_pkey PRIMARY KEY (id);


--
-- Name: user_structures user_structures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_structures
    ADD CONSTRAINT user_structures_pkey PRIMARY KEY (id);


--
-- Name: user_structures user_structures_user_id_structure_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_structures
    ADD CONSTRAINT user_structures_user_id_structure_id_key UNIQUE (user_id, structure_id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webhook_deliveries webhook_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id);


--
-- Name: idx_accounting_entries_source; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_accounting_entries_source ON public.accounting_entries USING btree (source_type, source_id) WHERE (source_id IS NOT NULL);


--
-- Name: idx_accounting_entries_structure_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_entries_structure_date ON public.accounting_entries USING btree (structure_id, entry_date);


--
-- Name: idx_accounting_lines_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_lines_entry ON public.accounting_lines USING btree (entry_id);


--
-- Name: idx_accounting_lines_structure_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_lines_structure_account ON public.accounting_lines USING btree (structure_id, account);


--
-- Name: idx_accounting_lines_structure_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_lines_structure_date ON public.accounting_lines USING btree (structure_id, entry_date);


--
-- Name: idx_bookings_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_client_id ON public.bookings USING btree (client_id);


--
-- Name: idx_bookings_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_phone ON public.bookings USING btree (phone);


--
-- Name: idx_bookings_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_room_id ON public.bookings USING btree (room_id);


--
-- Name: idx_clients_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_name ON public.clients USING btree (last_name, first_name);


--
-- Name: idx_clients_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_phone ON public.clients USING btree (phone);


--
-- Name: idx_clients_structure_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_structure_id ON public.clients USING btree (structure_id);


--
-- Name: idx_delivery_zones_structure_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_zones_structure_id ON public.delivery_zones USING btree (structure_id);


--
-- Name: idx_expenses_structure_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_structure_date ON public.expenses USING btree (structure_id, expense_date);


--
-- Name: idx_floors_structure_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_floors_structure_name ON public.floors USING btree (structure_id, lower(name));


--
-- Name: idx_forecast_snapshots_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_forecast_snapshots_date ON public.forecast_snapshots USING btree (structure_id, forecast_date);


--
-- Name: idx_goods_receipt_lines_receipt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goods_receipt_lines_receipt ON public.goods_receipt_lines USING btree (receipt_id);


--
-- Name: idx_goods_receipts_structure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goods_receipts_structure ON public.goods_receipts USING btree (structure_id, received_at DESC);


--
-- Name: idx_inventories_structure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventories_structure ON public.inventories USING btree (structure_id, created_at DESC);


--
-- Name: idx_movements_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movements_product ON public.stock_movements USING btree (product_id);


--
-- Name: idx_movements_structure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movements_structure ON public.stock_movements USING btree (structure_id);


--
-- Name: idx_notifications_structure_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_structure_id ON public.notifications USING btree (structure_id);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_order_accompaniments_accompaniment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_accompaniments_accompaniment_id ON public.order_accompaniments USING btree (accompaniment_id);


--
-- Name: idx_order_accompaniments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_accompaniments_order_id ON public.order_accompaniments USING btree (order_id);


--
-- Name: idx_order_accompaniments_parent_order_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_accompaniments_parent_order_item_id ON public.order_accompaniments USING btree (parent_order_item_id);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_parent_order_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_parent_order_item_id ON public.order_items USING btree (parent_order_item_id);


--
-- Name: idx_order_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id);


--
-- Name: idx_orders_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_client_id ON public.orders USING btree (client_id);


--
-- Name: idx_orders_courier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_courier_id ON public.orders USING btree (courier_id) WHERE (courier_id IS NOT NULL);


--
-- Name: idx_orders_delivery_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_delivery_status ON public.orders USING btree (structure_id, delivery_status) WHERE (delivery_status IS NOT NULL);


--
-- Name: idx_orders_paid_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_paid_at ON public.orders USING btree (structure_id, paid_at) WHERE (paid_at IS NOT NULL);


--
-- Name: idx_orders_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_phone ON public.orders USING btree (phone);


--
-- Name: idx_orders_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_room_id ON public.orders USING btree (room_id);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_structure_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_structure_created ON public.orders USING btree (structure_id, created_at);


--
-- Name: idx_orders_structure_external; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_orders_structure_external ON public.orders USING btree (structure_id, external_id) WHERE (external_id IS NOT NULL);


--
-- Name: idx_orders_structure_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_structure_id ON public.orders USING btree (structure_id);


--
-- Name: idx_orders_structure_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_orders_structure_invoice ON public.orders USING btree (structure_id, invoice_number) WHERE (invoice_number IS NOT NULL);


--
-- Name: idx_orders_structure_status_paid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_structure_status_paid ON public.orders USING btree (structure_id, status, paid_at);


--
-- Name: idx_orders_structure_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_structure_updated ON public.orders USING btree (structure_id, updated_at);


--
-- Name: idx_orders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_user_id ON public.orders USING btree (user_id);


--
-- Name: idx_password_reset_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: idx_payments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_order_id ON public.payments USING btree (order_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_product_accompaniments_accompaniment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_accompaniments_accompaniment_id ON public.product_accompaniments USING btree (accompaniment_id);


--
-- Name: idx_product_accompaniments_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_accompaniments_product_id ON public.product_accompaniments USING btree (product_id);


--
-- Name: idx_product_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_categories_parent ON public.product_categories USING btree (parent_id) WHERE (parent_id IS NOT NULL);


--
-- Name: idx_product_categories_structure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_categories_structure ON public.product_categories USING btree (structure_id, "position");


--
-- Name: idx_product_category_links_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_category_links_category ON public.product_category_links USING btree (category_id);


--
-- Name: idx_products_structure_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_structure_id ON public.products USING btree (structure_id);


--
-- Name: idx_promo_code_usages_promo_code_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_code_usages_promo_code_id ON public.promo_code_usages USING btree (promo_code_id);


--
-- Name: idx_promo_code_usages_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_code_usages_user_id ON public.promo_code_usages USING btree (user_id);


--
-- Name: idx_promo_codes_promotion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_promotion_id ON public.promo_codes USING btree (promotion_id);


--
-- Name: idx_promotions_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotions_is_active ON public.promotions USING btree (is_active);


--
-- Name: idx_promotions_structure_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotions_structure_id ON public.promotions USING btree (structure_id);


--
-- Name: idx_purchase_order_lines_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_lines_order ON public.purchase_order_lines USING btree (purchase_order_id);


--
-- Name: idx_purchase_orders_structure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_structure ON public.purchase_orders USING btree (structure_id, created_at DESC);


--
-- Name: idx_push_structure_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_structure_id ON public.push_subscriptions USING btree (structure_id);


--
-- Name: idx_push_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_user_id ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_recipe_items_ingredient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recipe_items_ingredient ON public.recipe_items USING btree (ingredient_id);


--
-- Name: idx_recipe_items_structure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recipe_items_structure ON public.recipe_items USING btree (structure_id);


--
-- Name: idx_rooms_structure_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_structure_id ON public.rooms USING btree (structure_id);


--
-- Name: idx_shifts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shifts_status ON public.shifts USING btree (status);


--
-- Name: idx_shifts_structure_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shifts_structure_id ON public.shifts USING btree (structure_id);


--
-- Name: idx_shifts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shifts_user_id ON public.shifts USING btree (user_id);


--
-- Name: idx_stock_movements_ingredient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_ingredient ON public.stock_movements USING btree (ingredient_id) WHERE (ingredient_id IS NOT NULL);


--
-- Name: idx_stock_movements_reason_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_reason_date ON public.stock_movements USING btree (structure_id, reason, created_at);


--
-- Name: idx_stock_movements_structure_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_structure_created ON public.stock_movements USING btree (structure_id, created_at DESC);


--
-- Name: idx_stocks_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stocks_product ON public.stocks USING btree (product_id);


--
-- Name: idx_stocks_structure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stocks_structure ON public.stocks USING btree (structure_id);


--
-- Name: idx_structures_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_structures_organization_id ON public.structures USING btree (organization_id);


--
-- Name: idx_supplier_items_structure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_items_structure ON public.supplier_items USING btree (structure_id);


--
-- Name: idx_suppliers_structure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_structure ON public.suppliers USING btree (structure_id);


--
-- Name: idx_tables_floor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tables_floor_id ON public.tables USING btree (floor_id);


--
-- Name: idx_tables_structure_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tables_structure_id ON public.tables USING btree (structure_id);


--
-- Name: idx_user_structures_structure_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_structures_structure_id ON public.user_structures USING btree (structure_id);


--
-- Name: idx_user_structures_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_structures_user_id ON public.user_structures USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_organization_id ON public.users USING btree (organization_id);


--
-- Name: idx_users_structure_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_structure_id ON public.users USING btree (structure_id);


--
-- Name: idx_webhook_deliveries_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_deliveries_due ON public.webhook_deliveries USING btree (next_attempt_at) WHERE ((status)::text = 'PENDING'::text);


--
-- Name: idx_webhook_deliveries_structure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_deliveries_structure ON public.webhook_deliveries USING btree (structure_id, created_at DESC);


--
-- Name: promotions_code_structure_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX promotions_code_structure_idx ON public.promotions USING btree (code_name, structure_id) WHERE (code_name IS NOT NULL);


--
-- Name: stocks_accompaniment_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stocks_accompaniment_unique ON public.stocks USING btree (structure_id, accompaniment_id) WHERE ((accompaniment_id IS NOT NULL) AND (product_id IS NULL));


--
-- Name: stocks_product_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stocks_product_unique ON public.stocks USING btree (structure_id, product_id) WHERE ((product_id IS NOT NULL) AND (accompaniment_id IS NULL));


--
-- Name: uq_ingredients_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ingredients_name ON public.ingredients USING btree (structure_id, lower((name)::text));


--
-- Name: uq_inventories_one_draft; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventories_one_draft ON public.inventories USING btree (structure_id) WHERE ((status)::text = 'DRAFT'::text);


--
-- Name: uq_inventory_lines_accompaniment; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventory_lines_accompaniment ON public.inventory_lines USING btree (inventory_id, accompaniment_id) WHERE (accompaniment_id IS NOT NULL);


--
-- Name: uq_inventory_lines_ingredient; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventory_lines_ingredient ON public.inventory_lines USING btree (inventory_id, ingredient_id) WHERE (ingredient_id IS NOT NULL);


--
-- Name: uq_inventory_lines_product; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventory_lines_product ON public.inventory_lines USING btree (inventory_id, product_id) WHERE (product_id IS NOT NULL);


--
-- Name: uq_product_categories_name_level; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_product_categories_name_level ON public.product_categories USING btree (structure_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower((name)::text));


--
-- Name: uq_recipe_items_accompaniment; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_recipe_items_accompaniment ON public.recipe_items USING btree (accompaniment_id, ingredient_id) WHERE (accompaniment_id IS NOT NULL);


--
-- Name: uq_recipe_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_recipe_items_product ON public.recipe_items USING btree (product_id, ingredient_id) WHERE (product_id IS NOT NULL);


--
-- Name: uq_stocks_ingredient; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_stocks_ingredient ON public.stocks USING btree (structure_id, ingredient_id);


--
-- Name: uq_supplier_items_ingredient; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_supplier_items_ingredient ON public.supplier_items USING btree (supplier_id, ingredient_id) WHERE (ingredient_id IS NOT NULL);


--
-- Name: uq_supplier_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_supplier_items_product ON public.supplier_items USING btree (supplier_id, product_id) WHERE (product_id IS NOT NULL);


--
-- Name: orders set_updated_at_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_orders BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ingredients trg_ingredient_unit_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ingredient_unit_change BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.check_ingredient_unit_change();


--
-- Name: inventory_lines trg_lock_closed_inventory_lines; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lock_closed_inventory_lines BEFORE INSERT OR UPDATE ON public.inventory_lines FOR EACH ROW EXECUTE FUNCTION public.lock_closed_inventory_lines();


--
-- Name: product_categories trg_product_category_parent; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_category_parent BEFORE INSERT OR UPDATE OF parent_id, structure_id ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public.check_product_category_parent();


--
-- Name: recipe_items trg_recipe_item_check; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_recipe_item_check BEFORE INSERT OR UPDATE ON public.recipe_items FOR EACH ROW EXECUTE FUNCTION public.check_recipe_item();


--
-- Name: clients update_clients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: floors update_floors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_floors_updated_at BEFORE UPDATE ON public.floors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_recipes update_recipes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON public.product_recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stocks update_stocks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stocks_updated_at BEFORE UPDATE ON public.stocks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tables update_tables_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON public.tables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: accompaniments accompaniments_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accompaniments
    ADD CONSTRAINT accompaniments_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: accounting_accounts accounting_accounts_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_accounts
    ADD CONSTRAINT accounting_accounts_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: accounting_counters accounting_counters_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_counters
    ADD CONSTRAINT accounting_counters_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: accounting_entries accounting_entries_reversal_of_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_entries
    ADD CONSTRAINT accounting_entries_reversal_of_fkey FOREIGN KEY (reversal_of) REFERENCES public.accounting_entries(id);


--
-- Name: accounting_entries accounting_entries_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_entries
    ADD CONSTRAINT accounting_entries_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: accounting_lines accounting_lines_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_lines
    ADD CONSTRAINT accounting_lines_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.accounting_entries(id) ON DELETE CASCADE;


--
-- Name: accounting_lines accounting_lines_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_lines
    ADD CONSTRAINT accounting_lines_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: accounting_lines accounting_lines_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_lines
    ADD CONSTRAINT accounting_lines_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: api_rate_windows api_rate_windows_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_rate_windows
    ADD CONSTRAINT api_rate_windows_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: api_usage api_usage_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_usage
    ADD CONSTRAINT api_usage_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: clients clients_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: delivery_zones delivery_zones_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.accounting_entries(id);


--
-- Name: expenses expenses_payment_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_payment_entry_id_fkey FOREIGN KEY (payment_entry_id) REFERENCES public.accounting_entries(id);


--
-- Name: expenses expenses_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: floors floors_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.floors
    ADD CONSTRAINT floors_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: forecast_events forecast_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forecast_events
    ADD CONSTRAINT forecast_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: forecast_events forecast_events_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forecast_events
    ADD CONSTRAINT forecast_events_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: forecast_snapshots forecast_snapshots_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forecast_snapshots
    ADD CONSTRAINT forecast_snapshots_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: forecast_snapshots forecast_snapshots_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forecast_snapshots
    ADD CONSTRAINT forecast_snapshots_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: goods_receipt_lines goods_receipt_lines_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_lines
    ADD CONSTRAINT goods_receipt_lines_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE SET NULL;


--
-- Name: goods_receipt_lines goods_receipt_lines_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_lines
    ADD CONSTRAINT goods_receipt_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: goods_receipt_lines goods_receipt_lines_purchase_order_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_lines
    ADD CONSTRAINT goods_receipt_lines_purchase_order_line_id_fkey FOREIGN KEY (purchase_order_line_id) REFERENCES public.purchase_order_lines(id) ON DELETE SET NULL;


--
-- Name: goods_receipt_lines goods_receipt_lines_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_lines
    ADD CONSTRAINT goods_receipt_lines_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.goods_receipts(id) ON DELETE CASCADE;


--
-- Name: goods_receipts goods_receipts_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;


--
-- Name: goods_receipts goods_receipts_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: goods_receipts goods_receipts_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: goods_receipts goods_receipts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;


--
-- Name: ingredients ingredients_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: inventories inventories_started_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventories
    ADD CONSTRAINT inventories_started_by_fkey FOREIGN KEY (started_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventories inventories_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventories
    ADD CONSTRAINT inventories_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: inventories inventories_validated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventories
    ADD CONSTRAINT inventories_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory_lines inventory_lines_accompaniment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_lines
    ADD CONSTRAINT inventory_lines_accompaniment_id_fkey FOREIGN KEY (accompaniment_id) REFERENCES public.accompaniments(id) ON DELETE CASCADE;


--
-- Name: inventory_lines inventory_lines_counted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_lines
    ADD CONSTRAINT inventory_lines_counted_by_fkey FOREIGN KEY (counted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory_lines inventory_lines_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_lines
    ADD CONSTRAINT inventory_lines_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: inventory_lines inventory_lines_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_lines
    ADD CONSTRAINT inventory_lines_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventories(id) ON DELETE CASCADE;


--
-- Name: inventory_lines inventory_lines_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_lines
    ADD CONSTRAINT inventory_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: licenses licenses_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: licenses licenses_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: order_accompaniments order_accompaniments_accompaniment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_accompaniments
    ADD CONSTRAINT order_accompaniments_accompaniment_id_fkey FOREIGN KEY (accompaniment_id) REFERENCES public.accompaniments(id) ON DELETE CASCADE;


--
-- Name: order_accompaniments order_accompaniments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_accompaniments
    ADD CONSTRAINT order_accompaniments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_accompaniments order_accompaniments_parent_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_accompaniments
    ADD CONSTRAINT order_accompaniments_parent_order_item_id_fkey FOREIGN KEY (parent_order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_parent_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_parent_order_item_id_fkey FOREIGN KEY (parent_order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: orders orders_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: orders orders_courier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_courier_id_fkey FOREIGN KEY (courier_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: orders orders_delivery_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_delivery_zone_id_fkey FOREIGN KEY (delivery_zone_id) REFERENCES public.delivery_zones(id) ON DELETE SET NULL;


--
-- Name: orders orders_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE SET NULL;


--
-- Name: orders orders_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL;


--
-- Name: orders orders_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: orders orders_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE SET NULL;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: point_api_credentials point_api_credentials_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_api_credentials
    ADD CONSTRAINT point_api_credentials_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: point_api_test_credentials point_api_test_credentials_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_api_test_credentials
    ADD CONSTRAINT point_api_test_credentials_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: product_accompaniments product_accompaniments_accompaniment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_accompaniments
    ADD CONSTRAINT product_accompaniments_accompaniment_id_fkey FOREIGN KEY (accompaniment_id) REFERENCES public.accompaniments(id) ON DELETE CASCADE;


--
-- Name: product_accompaniments product_accompaniments_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_accompaniments
    ADD CONSTRAINT product_accompaniments_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_accompaniments product_accompaniments_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_accompaniments
    ADD CONSTRAINT product_accompaniments_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: product_categories product_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.product_categories(id) ON DELETE RESTRICT;


--
-- Name: product_categories product_categories_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: product_category_links product_category_links_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category_links
    ADD CONSTRAINT product_category_links_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE CASCADE;


--
-- Name: product_category_links product_category_links_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category_links
    ADD CONSTRAINT product_category_links_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_recipes product_recipes_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_recipes
    ADD CONSTRAINT product_recipes_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_recipes product_recipes_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_recipes
    ADD CONSTRAINT product_recipes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_recipes product_recipes_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_recipes
    ADD CONSTRAINT product_recipes_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: products products_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: promo_code_usages promo_code_usages_promo_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_usages
    ADD CONSTRAINT promo_code_usages_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE CASCADE;


--
-- Name: promo_code_usages promo_code_usages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_usages
    ADD CONSTRAINT promo_code_usages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: promo_codes promo_codes_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE;


--
-- Name: promotions promotions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: promotions promotions_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: purchase_counters purchase_counters_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_counters
    ADD CONSTRAINT purchase_counters_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: purchase_order_lines purchase_order_lines_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE SET NULL;


--
-- Name: purchase_order_lines purchase_order_lines_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: purchase_order_lines purchase_order_lines_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_lines purchase_order_lines_supplier_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_supplier_item_id_fkey FOREIGN KEY (supplier_item_id) REFERENCES public.supplier_items(id) ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;


--
-- Name: push_subscriptions push_subscriptions_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recipe_items recipe_items_accompaniment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_accompaniment_id_fkey FOREIGN KEY (accompaniment_id) REFERENCES public.accompaniments(id) ON DELETE CASCADE;


--
-- Name: recipe_items recipe_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE RESTRICT;


--
-- Name: recipe_items recipe_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: recipe_items recipe_items_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: rooms rooms_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: shifts shifts_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: shifts shifts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_accompaniment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_accompaniment_id_fkey FOREIGN KEY (accompaniment_id) REFERENCES public.accompaniments(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stocks stocks_accompaniment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocks
    ADD CONSTRAINT stocks_accompaniment_id_fkey FOREIGN KEY (accompaniment_id) REFERENCES public.accompaniments(id) ON DELETE CASCADE;


--
-- Name: stocks stocks_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocks
    ADD CONSTRAINT stocks_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: stocks stocks_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocks
    ADD CONSTRAINT stocks_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stocks stocks_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocks
    ADD CONSTRAINT stocks_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: structures structures_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.structures
    ADD CONSTRAINT structures_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: supplier_items supplier_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_items
    ADD CONSTRAINT supplier_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: supplier_items supplier_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_items
    ADD CONSTRAINT supplier_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: supplier_items supplier_items_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_items
    ADD CONSTRAINT supplier_items_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: supplier_items supplier_items_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_items
    ADD CONSTRAINT supplier_items_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: suppliers suppliers_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: tables tables_floor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_floor_id_fkey FOREIGN KEY (floor_id) REFERENCES public.floors(id) ON DELETE SET NULL;


--
-- Name: tables tables_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: user_structures user_structures_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_structures
    ADD CONSTRAINT user_structures_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: user_structures user_structures_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_structures
    ADD CONSTRAINT user_structures_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: users users_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: webhook_deliveries webhook_deliveries_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;


--
-- Name: promotions Admins can manage their structure's promotions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage their structure's promotions" ON public.promotions USING ((structure_id = ( SELECT users.structure_id
   FROM public.users
  WHERE (users.id = auth.uid()))));


--
-- Name: shifts Users can create their own shifts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own shifts" ON public.shifts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: shifts Users can update their own shifts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own shifts" ON public.shifts FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: shifts Users can view their own shifts or admins can view all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own shifts or admins can view all" ON public.shifts FOR SELECT USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'ADMIN'::text))))));


--
-- Name: promotions Users can view their structure's promotions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their structure's promotions" ON public.promotions FOR SELECT USING ((structure_id = ( SELECT users.structure_id
   FROM public.users
  WHERE (users.id = auth.uid()))));


--
-- Name: accompaniments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accompaniments ENABLE ROW LEVEL SECURITY;

--
-- Name: accounting_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: accounting_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounting_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: accounting_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: accounting_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounting_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: api_rate_windows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_rate_windows ENABLE ROW LEVEL SECURITY;

--
-- Name: api_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: floors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;

--
-- Name: forecast_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forecast_events ENABLE ROW LEVEL SECURITY;

--
-- Name: forecast_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forecast_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: goods_receipt_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.goods_receipt_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: goods_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: ingredients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

--
-- Name: inventories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventories ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: licenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

--
-- Name: licenses licenses_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY licenses_anon_select ON public.licenses FOR SELECT TO anon USING (public.is_organization_license_active(organization_id));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: order_accompaniments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_accompaniments ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations organizations_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_anon_select ON public.organizations FOR SELECT TO anon USING (public.is_organization_license_active(id));


--
-- Name: password_reset_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: point_api_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.point_api_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: point_api_test_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.point_api_test_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: product_accompaniments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_accompaniments ENABLE ROW LEVEL SECURITY;

--
-- Name: product_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: product_category_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_category_links ENABLE ROW LEVEL SECURITY;

--
-- Name: product_recipes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_code_usages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promo_code_usages ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: promotions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: recipe_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;

--
-- Name: rooms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: stocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;

--
-- Name: structures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.structures ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supplier_items ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: tables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

--
-- Name: user_structures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_structures ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION accompaniment_list_stats(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.accompaniment_list_stats(p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.accompaniment_list_stats(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION analytics_summary(p_structure_id uuid, p_since timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.analytics_summary(p_structure_id uuid, p_since timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.analytics_summary(p_structure_id uuid, p_since timestamp with time zone) TO service_role;


--
-- Name: FUNCTION api_count_order(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.api_count_order(p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.api_count_order(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION api_hit(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.api_hit(p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.api_hit(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION assign_invoice_number(p_kind text, p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assign_invoice_number(p_kind text, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_invoice_number(p_kind text, p_id uuid) TO service_role;


--
-- Name: FUNCTION booking_list_stats(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.booking_list_stats(p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.booking_list_stats(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION check_ingredient_unit_change(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_ingredient_unit_change() TO anon;
GRANT ALL ON FUNCTION public.check_ingredient_unit_change() TO authenticated;
GRANT ALL ON FUNCTION public.check_ingredient_unit_change() TO service_role;


--
-- Name: FUNCTION check_product_category_parent(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_product_category_parent() TO anon;
GRANT ALL ON FUNCTION public.check_product_category_parent() TO authenticated;
GRANT ALL ON FUNCTION public.check_product_category_parent() TO service_role;


--
-- Name: FUNCTION check_recipe_item(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_recipe_item() TO anon;
GRANT ALL ON FUNCTION public.check_recipe_item() TO authenticated;
GRANT ALL ON FUNCTION public.check_recipe_item() TO service_role;


--
-- Name: TABLE webhook_deliveries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.webhook_deliveries TO anon;
GRANT ALL ON TABLE public.webhook_deliveries TO authenticated;
GRANT ALL ON TABLE public.webhook_deliveries TO service_role;


--
-- Name: FUNCTION claim_due_webhooks(p_limit integer, p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_due_webhooks(p_limit integer, p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_due_webhooks(p_limit integer, p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION client_list_stats(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.client_list_stats(p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.client_list_stats(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION daily_product_sales(p_structure_id uuid, p_from date, p_to date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.daily_product_sales(p_structure_id uuid, p_from date, p_to date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.daily_product_sales(p_structure_id uuid, p_from date, p_to date) TO service_role;


--
-- Name: FUNCTION dashboard_summary(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.dashboard_summary(p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.dashboard_summary(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION expense_list_stats(p_structure_id uuid, p_from date, p_to date, p_status text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.expense_list_stats(p_structure_id uuid, p_from date, p_to date, p_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.expense_list_stats(p_structure_id uuid, p_from date, p_to date, p_status text) TO service_role;


--
-- Name: FUNCTION hourly_sales_profile(p_structure_id uuid, p_from date, p_to date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.hourly_sales_profile(p_structure_id uuid, p_from date, p_to date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hourly_sales_profile(p_structure_id uuid, p_from date, p_to date) TO service_role;


--
-- Name: FUNCTION ingredient_list_stats(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ingredient_list_stats(p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ingredient_list_stats(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION inventory_list_stats(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.inventory_list_stats(p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.inventory_list_stats(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION is_organization_license_active(p_organization_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_organization_license_active(p_organization_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_organization_license_active(p_organization_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_organization_license_active(p_organization_id uuid) TO service_role;


--
-- Name: FUNCTION is_structure_license_active(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_structure_license_active(p_structure_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_structure_license_active(p_structure_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_structure_license_active(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION lock_closed_inventory_lines(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lock_closed_inventory_lines() TO anon;
GRANT ALL ON FUNCTION public.lock_closed_inventory_lines() TO authenticated;
GRANT ALL ON FUNCTION public.lock_closed_inventory_lines() TO service_role;


--
-- Name: FUNCTION loss_list_stats(p_structure_id uuid, p_from timestamp with time zone, p_to timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.loss_list_stats(p_structure_id uuid, p_from timestamp with time zone, p_to timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.loss_list_stats(p_structure_id uuid, p_from timestamp with time zone, p_to timestamp with time zone) TO service_role;


--
-- Name: FUNCTION next_purchase_number(p_structure_id uuid, p_kind text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.next_purchase_number(p_structure_id uuid, p_kind text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.next_purchase_number(p_structure_id uuid, p_kind text) TO service_role;


--
-- Name: FUNCTION order_list_stats(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.order_list_stats(p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.order_list_stats(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION organization_list_stats(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.organization_list_stats() FROM PUBLIC;
GRANT ALL ON FUNCTION public.organization_list_stats() TO service_role;


--
-- Name: FUNCTION post_accounting_entry(p_structure_id uuid, p_journal text, p_entry_date date, p_label text, p_reference text, p_source_type text, p_source_id uuid, p_reversal_of uuid, p_created_by uuid, p_lines jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_accounting_entry(p_structure_id uuid, p_journal text, p_entry_date date, p_label text, p_reference text, p_source_type text, p_source_id uuid, p_reversal_of uuid, p_created_by uuid, p_lines jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_accounting_entry(p_structure_id uuid, p_journal text, p_entry_date date, p_label text, p_reference text, p_source_type text, p_source_id uuid, p_reversal_of uuid, p_created_by uuid, p_lines jsonb) TO service_role;


--
-- Name: FUNCTION product_list_stats(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.product_list_stats(p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.product_list_stats(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION promotion_list_stats(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.promotion_list_stats(p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.promotion_list_stats(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION purchase_order_list_stats(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purchase_order_list_stats(p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.purchase_order_list_stats(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION receipt_list_stats(p_structure_id uuid, p_from timestamp with time zone, p_to timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.receipt_list_stats(p_structure_id uuid, p_from timestamp with time zone, p_to timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.receipt_list_stats(p_structure_id uuid, p_from timestamp with time zone, p_to timestamp with time zone) TO service_role;


--
-- Name: FUNCTION receive_goods(p_structure_id uuid, p_supplier_id uuid, p_order_id uuid, p_user_id uuid, p_invoice_reference text, p_note text, p_lines jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.receive_goods(p_structure_id uuid, p_supplier_id uuid, p_order_id uuid, p_user_id uuid, p_invoice_reference text, p_note text, p_lines jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.receive_goods(p_structure_id uuid, p_supplier_id uuid, p_order_id uuid, p_user_id uuid, p_invoice_reference text, p_note text, p_lines jsonb) TO service_role;


--
-- Name: FUNCTION room_list_stats(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.room_list_stats(p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.room_list_stats(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION shift_list_stats(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.shift_list_stats(p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.shift_list_stats(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION shift_scope_stats(p_structure_ids uuid[], p_status text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.shift_scope_stats(p_structure_ids uuid[], p_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.shift_scope_stats(p_structure_ids uuid[], p_status text) TO service_role;


--
-- Name: FUNCTION stock_movement_list_stats(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.stock_movement_list_stats(p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.stock_movement_list_stats(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION user_list_stats(p_structure_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.user_list_stats(p_structure_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.user_list_stats(p_structure_id uuid) TO service_role;


--
-- Name: FUNCTION validate_inventory(p_inventory_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_inventory(p_inventory_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_inventory(p_inventory_id uuid, p_user_id uuid) TO service_role;


--
-- Name: TABLE accompaniments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.accompaniments TO anon;
GRANT ALL ON TABLE public.accompaniments TO authenticated;
GRANT ALL ON TABLE public.accompaniments TO service_role;


--
-- Name: TABLE accounting_accounts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.accounting_accounts TO anon;
GRANT ALL ON TABLE public.accounting_accounts TO authenticated;
GRANT ALL ON TABLE public.accounting_accounts TO service_role;


--
-- Name: TABLE accounting_counters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.accounting_counters TO anon;
GRANT ALL ON TABLE public.accounting_counters TO authenticated;
GRANT ALL ON TABLE public.accounting_counters TO service_role;


--
-- Name: TABLE accounting_entries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.accounting_entries TO anon;
GRANT ALL ON TABLE public.accounting_entries TO authenticated;
GRANT ALL ON TABLE public.accounting_entries TO service_role;


--
-- Name: TABLE accounting_lines; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.accounting_lines TO anon;
GRANT ALL ON TABLE public.accounting_lines TO authenticated;
GRANT ALL ON TABLE public.accounting_lines TO service_role;


--
-- Name: TABLE api_rate_windows; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.api_rate_windows TO anon;
GRANT ALL ON TABLE public.api_rate_windows TO authenticated;
GRANT ALL ON TABLE public.api_rate_windows TO service_role;


--
-- Name: TABLE api_usage; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.api_usage TO anon;
GRANT ALL ON TABLE public.api_usage TO authenticated;
GRANT ALL ON TABLE public.api_usage TO service_role;


--
-- Name: TABLE bookings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.bookings TO anon;
GRANT ALL ON TABLE public.bookings TO authenticated;
GRANT ALL ON TABLE public.bookings TO service_role;


--
-- Name: TABLE clients; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.clients TO anon;
GRANT ALL ON TABLE public.clients TO authenticated;
GRANT ALL ON TABLE public.clients TO service_role;


--
-- Name: TABLE delivery_zones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.delivery_zones TO anon;
GRANT ALL ON TABLE public.delivery_zones TO authenticated;
GRANT ALL ON TABLE public.delivery_zones TO service_role;


--
-- Name: TABLE expenses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.expenses TO anon;
GRANT ALL ON TABLE public.expenses TO authenticated;
GRANT ALL ON TABLE public.expenses TO service_role;


--
-- Name: TABLE floors; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.floors TO anon;
GRANT ALL ON TABLE public.floors TO authenticated;
GRANT ALL ON TABLE public.floors TO service_role;


--
-- Name: TABLE forecast_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.forecast_events TO anon;
GRANT ALL ON TABLE public.forecast_events TO authenticated;
GRANT ALL ON TABLE public.forecast_events TO service_role;


--
-- Name: TABLE forecast_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.forecast_snapshots TO anon;
GRANT ALL ON TABLE public.forecast_snapshots TO authenticated;
GRANT ALL ON TABLE public.forecast_snapshots TO service_role;


--
-- Name: TABLE goods_receipt_lines; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.goods_receipt_lines TO anon;
GRANT ALL ON TABLE public.goods_receipt_lines TO authenticated;
GRANT ALL ON TABLE public.goods_receipt_lines TO service_role;


--
-- Name: TABLE goods_receipts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.goods_receipts TO anon;
GRANT ALL ON TABLE public.goods_receipts TO authenticated;
GRANT ALL ON TABLE public.goods_receipts TO service_role;


--
-- Name: TABLE ingredients; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ingredients TO anon;
GRANT ALL ON TABLE public.ingredients TO authenticated;
GRANT ALL ON TABLE public.ingredients TO service_role;


--
-- Name: TABLE inventories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.inventories TO anon;
GRANT ALL ON TABLE public.inventories TO authenticated;
GRANT ALL ON TABLE public.inventories TO service_role;


--
-- Name: TABLE inventory_lines; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.inventory_lines TO anon;
GRANT ALL ON TABLE public.inventory_lines TO authenticated;
GRANT ALL ON TABLE public.inventory_lines TO service_role;


--
-- Name: TABLE licenses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.licenses TO anon;
GRANT ALL ON TABLE public.licenses TO authenticated;
GRANT ALL ON TABLE public.licenses TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE order_accompaniments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_accompaniments TO anon;
GRANT ALL ON TABLE public.order_accompaniments TO authenticated;
GRANT ALL ON TABLE public.order_accompaniments TO service_role;


--
-- Name: TABLE order_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_items TO anon;
GRANT ALL ON TABLE public.order_items TO authenticated;
GRANT ALL ON TABLE public.order_items TO service_role;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.orders TO anon;
GRANT ALL ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;


--
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organizations TO anon;
GRANT ALL ON TABLE public.organizations TO authenticated;
GRANT ALL ON TABLE public.organizations TO service_role;


--
-- Name: TABLE password_reset_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.password_reset_tokens TO anon;
GRANT ALL ON TABLE public.password_reset_tokens TO authenticated;
GRANT ALL ON TABLE public.password_reset_tokens TO service_role;


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payments TO anon;
GRANT ALL ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;


--
-- Name: TABLE point_api_credentials; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.point_api_credentials TO anon;
GRANT ALL ON TABLE public.point_api_credentials TO authenticated;
GRANT ALL ON TABLE public.point_api_credentials TO service_role;


--
-- Name: TABLE point_api_test_credentials; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.point_api_test_credentials TO anon;
GRANT ALL ON TABLE public.point_api_test_credentials TO authenticated;
GRANT ALL ON TABLE public.point_api_test_credentials TO service_role;


--
-- Name: TABLE product_accompaniments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_accompaniments TO anon;
GRANT ALL ON TABLE public.product_accompaniments TO authenticated;
GRANT ALL ON TABLE public.product_accompaniments TO service_role;


--
-- Name: TABLE product_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_categories TO anon;
GRANT ALL ON TABLE public.product_categories TO authenticated;
GRANT ALL ON TABLE public.product_categories TO service_role;


--
-- Name: TABLE product_category_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_category_links TO anon;
GRANT ALL ON TABLE public.product_category_links TO authenticated;
GRANT ALL ON TABLE public.product_category_links TO service_role;


--
-- Name: TABLE product_recipes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_recipes TO anon;
GRANT ALL ON TABLE public.product_recipes TO authenticated;
GRANT ALL ON TABLE public.product_recipes TO service_role;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.products TO anon;
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;


--
-- Name: TABLE promo_code_usages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.promo_code_usages TO anon;
GRANT ALL ON TABLE public.promo_code_usages TO authenticated;
GRANT ALL ON TABLE public.promo_code_usages TO service_role;


--
-- Name: TABLE promo_codes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.promo_codes TO anon;
GRANT ALL ON TABLE public.promo_codes TO authenticated;
GRANT ALL ON TABLE public.promo_codes TO service_role;


--
-- Name: TABLE promotions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.promotions TO anon;
GRANT ALL ON TABLE public.promotions TO authenticated;
GRANT ALL ON TABLE public.promotions TO service_role;


--
-- Name: TABLE purchase_counters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.purchase_counters TO anon;
GRANT ALL ON TABLE public.purchase_counters TO authenticated;
GRANT ALL ON TABLE public.purchase_counters TO service_role;


--
-- Name: TABLE purchase_order_lines; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.purchase_order_lines TO anon;
GRANT ALL ON TABLE public.purchase_order_lines TO authenticated;
GRANT ALL ON TABLE public.purchase_order_lines TO service_role;


--
-- Name: TABLE purchase_orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.purchase_orders TO anon;
GRANT ALL ON TABLE public.purchase_orders TO authenticated;
GRANT ALL ON TABLE public.purchase_orders TO service_role;


--
-- Name: TABLE push_subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.push_subscriptions TO anon;
GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;


--
-- Name: TABLE recipe_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.recipe_items TO anon;
GRANT ALL ON TABLE public.recipe_items TO authenticated;
GRANT ALL ON TABLE public.recipe_items TO service_role;


--
-- Name: TABLE rooms; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rooms TO anon;
GRANT ALL ON TABLE public.rooms TO authenticated;
GRANT ALL ON TABLE public.rooms TO service_role;


--
-- Name: TABLE shifts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shifts TO anon;
GRANT ALL ON TABLE public.shifts TO authenticated;
GRANT ALL ON TABLE public.shifts TO service_role;


--
-- Name: TABLE stock_movements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stock_movements TO anon;
GRANT ALL ON TABLE public.stock_movements TO authenticated;
GRANT ALL ON TABLE public.stock_movements TO service_role;


--
-- Name: TABLE stocks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stocks TO anon;
GRANT ALL ON TABLE public.stocks TO authenticated;
GRANT ALL ON TABLE public.stocks TO service_role;


--
-- Name: TABLE structures; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.structures TO anon;
GRANT ALL ON TABLE public.structures TO authenticated;
GRANT ALL ON TABLE public.structures TO service_role;


--
-- Name: TABLE supplier_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.supplier_items TO anon;
GRANT ALL ON TABLE public.supplier_items TO authenticated;
GRANT ALL ON TABLE public.supplier_items TO service_role;


--
-- Name: TABLE suppliers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.suppliers TO anon;
GRANT ALL ON TABLE public.suppliers TO authenticated;
GRANT ALL ON TABLE public.suppliers TO service_role;


--
-- Name: TABLE tables; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tables TO anon;
GRANT ALL ON TABLE public.tables TO authenticated;
GRANT ALL ON TABLE public.tables TO service_role;


--
-- Name: TABLE user_structures; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_structures TO anon;
GRANT ALL ON TABLE public.user_structures TO authenticated;
GRANT ALL ON TABLE public.user_structures TO service_role;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--


