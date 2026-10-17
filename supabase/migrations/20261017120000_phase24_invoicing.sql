-- Phase 24 — Facturation clients (offre « Comptabilité seule »)
--
-- Clients facturés, devis / factures / avoirs, lignes, encaissements, numérotation
-- continue par point, type de document et année, et rattachement des écritures au
-- client (compte 411) comme elles le sont déjà au fournisseur (401).
--
-- Accès : service role uniquement (RLS activée sans politique, comme le reste de la
-- comptabilité). À exécuter une fois ; le script est rejouable sans erreur.

BEGIN;

-- ── Clients facturés ─────────────────────────────────────
-- Distincts des fiches CRM (clients du restaurant) : ici des entreprises ou
-- particuliers à qui l'on adresse des factures.
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_name text,
  phone varchar(30),
  email text,
  niu varchar(50),
  rccm varchar(60),
  address text,
  city text,
  payment_terms_days smallint NOT NULL DEFAULT 30 CHECK (payment_terms_days BETWEEN 0 AND 365),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_structure ON public.customers (structure_id, name);

-- ── Documents de vente ───────────────────────────────────
-- kind   : QUOTE (devis), INVOICE (facture), CREDIT_NOTE (avoir)
-- status : DRAFT (modifiable, sans numéro) → ISSUED (numéroté, figé, comptabilisé
--          pour une facture ou un avoir). Devis : ACCEPTED / REFUSED / CONVERTED.
--          CANCELLED : brouillon abandonné (un document émis s'annule par un avoir).
CREATE TABLE IF NOT EXISTS public.sales_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  kind varchar(12) NOT NULL CHECK (kind IN ('QUOTE', 'INVOICE', 'CREDIT_NOTE')),
  status varchar(12) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'ISSUED', 'ACCEPTED', 'REFUSED', 'CONVERTED', 'CANCELLED')),
  number varchar(30),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subject text,
  notes text,
  -- Montants (XAF, arrondis à l'unité à l'enregistrement)
  subtotal_ht numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_ttc numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  -- Facture : part annulée par des avoirs (reste dû = total − réglé − crédité)
  amount_credited numeric(14,2) NOT NULL DEFAULT 0,
  -- Reste dû, calculé par la base (filtre « impayées » de la liste)
  remaining_due numeric(14,2) GENERATED ALWAYS AS (total_ttc - amount_paid - amount_credited) STORED,
  -- Devis d'origine (facture) ou facture corrigée (avoir)
  source_document_id uuid REFERENCES public.sales_documents(id),
  entry_id uuid,
  issued_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (amount_paid >= 0),
  CHECK (amount_credited >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_documents_number ON public.sales_documents (structure_id, number) WHERE number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_documents_list ON public.sales_documents (structure_id, kind, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_documents_customer ON public.sales_documents (customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_documents_unpaid ON public.sales_documents (structure_id, due_date) WHERE kind = 'INVOICE' AND status = 'ISSUED' AND remaining_due > 0;

CREATE TABLE IF NOT EXISTS public.sales_document_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
  position smallint NOT NULL DEFAULT 0,
  description text NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0),  -- hors taxe
  discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  tax_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate BETWEEN 0 AND 100),
  account varchar(12) NOT NULL DEFAULT '706',               -- compte de produit (classe 7)
  total_ht numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sales_document_lines_document ON public.sales_document_lines (document_id, position);

-- ── Encaissements ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_method varchar(20) NOT NULL,
  paid_at date NOT NULL,
  reference text,
  entry_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_payments_document ON public.sales_payments (document_id);

-- ── Numérotation continue : FAC-2026-00001, DEV-…, AV-… ─
CREATE TABLE IF NOT EXISTS public.sales_document_counters (
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  kind varchar(12) NOT NULL,
  year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (structure_id, kind, year)
);

-- Attribue le numéro et passe le document en ISSUED. Idempotent (renvoie le numéro
-- existant) ; verrou sur le document pour deux validations simultanées.
CREATE OR REPLACE FUNCTION public.issue_sales_document(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_doc sales_documents%ROWTYPE;
  v_year integer;
  v_counter integer;
  v_number text;
BEGIN
  SELECT * INTO v_doc FROM sales_documents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SALES_DOCUMENT_NOT_FOUND';
  END IF;
  IF v_doc.number IS NOT NULL THEN
    RETURN v_doc.number;
  END IF;
  IF v_doc.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'SALES_DOCUMENT_NOT_DRAFT';
  END IF;

  v_year := EXTRACT(YEAR FROM v_doc.issue_date)::integer;
  INSERT INTO sales_document_counters (structure_id, kind, year, last_number)
  VALUES (v_doc.structure_id, v_doc.kind, v_year, 1)
  ON CONFLICT (structure_id, kind, year)
  DO UPDATE SET last_number = sales_document_counters.last_number + 1
  RETURNING last_number INTO v_counter;

  v_number := CASE v_doc.kind WHEN 'INVOICE' THEN 'FAC' WHEN 'QUOTE' THEN 'DEV' ELSE 'AV' END
    || '-' || v_year || '-' || lpad(v_counter::text, 5, '0');

  -- Avoir rattaché à une facture : il diminue le reste dû de cette facture
  IF v_doc.kind = 'CREDIT_NOTE' AND v_doc.source_document_id IS NOT NULL THEN
    UPDATE sales_documents
    SET amount_credited = ROUND(amount_credited + v_doc.total_ttc, 2), updated_at = now()
    WHERE id = v_doc.source_document_id
      AND kind = 'INVOICE'
      AND ROUND(amount_paid + amount_credited + v_doc.total_ttc, 2) <= total_ttc;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SALES_CREDIT_TOO_HIGH';
    END IF;
  END IF;

  UPDATE sales_documents
  SET number = v_number, status = 'ISSUED', issued_at = now(), updated_at = now()
  WHERE id = p_id;
  RETURN v_number;
END;
$$;

-- Encaissement : enregistre le paiement et met à jour le montant réglé, sans jamais
-- dépasser le total (deux encaissements simultanés sont sérialisés par le verrou).
CREATE OR REPLACE FUNCTION public.record_sales_payment(
  p_document_id uuid, p_amount numeric, p_method text, p_paid_at date, p_reference text, p_created_by uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_doc sales_documents%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO v_doc FROM sales_documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SALES_DOCUMENT_NOT_FOUND';
  END IF;
  IF v_doc.kind <> 'INVOICE' OR v_doc.status <> 'ISSUED' THEN
    RAISE EXCEPTION 'SALES_PAYMENT_NOT_ALLOWED';
  END IF;
  IF p_amount <= 0 OR ROUND(v_doc.amount_paid + v_doc.amount_credited + p_amount, 2) > v_doc.total_ttc THEN
    RAISE EXCEPTION 'SALES_PAYMENT_TOO_HIGH';
  END IF;

  INSERT INTO sales_payments (structure_id, document_id, amount, payment_method, paid_at, reference, created_by)
  VALUES (v_doc.structure_id, p_document_id, ROUND(p_amount, 2), p_method, p_paid_at, p_reference, p_created_by)
  RETURNING id INTO v_id;

  UPDATE sales_documents SET amount_paid = ROUND(amount_paid + p_amount, 2), updated_at = now() WHERE id = p_document_id;
  RETURN v_id;
END;
$$;

-- Totaux de la liste (toutes pages) : facturé, encaissé, reste dû, en retard.
CREATE OR REPLACE FUNCTION public.sales_document_list_stats(p_structure_id uuid, p_today date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'invoiced', COALESCE(SUM(total_ttc) FILTER (WHERE kind = 'INVOICE' AND status = 'ISSUED'), 0)
              - COALESCE(SUM(total_ttc) FILTER (WHERE kind = 'CREDIT_NOTE' AND status = 'ISSUED'), 0),
    'collected', COALESCE(SUM(amount_paid) FILTER (WHERE kind = 'INVOICE' AND status = 'ISSUED'), 0),
    'outstanding', COALESCE(SUM(total_ttc - amount_paid - amount_credited) FILTER (WHERE kind = 'INVOICE' AND status = 'ISSUED'), 0),
    'overdue', COALESCE(SUM(total_ttc - amount_paid - amount_credited) FILTER (
      WHERE kind = 'INVOICE' AND status = 'ISSUED' AND amount_paid + amount_credited < total_ttc AND due_date < p_today), 0),
    'overdueCount', COUNT(*) FILTER (
      WHERE kind = 'INVOICE' AND status = 'ISSUED' AND amount_paid + amount_credited < total_ttc AND due_date < p_today),
    'drafts', COUNT(*) FILTER (WHERE status = 'DRAFT'),
    'openQuotes', COUNT(*) FILTER (WHERE kind = 'QUOTE' AND status = 'ISSUED')
  )
  FROM sales_documents
  WHERE structure_id = p_structure_id;
$$;

-- ── Écritures rattachées au client (411) ─────────────────
ALTER TABLE public.accounting_lines ADD COLUMN IF NOT EXISTS customer_id uuid;
CREATE INDEX IF NOT EXISTS idx_accounting_lines_customer ON public.accounting_lines (customer_id) WHERE customer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.post_accounting_entry(p_structure_id uuid, p_journal text, p_entry_date date, p_label text, p_reference text, p_source_type text, p_source_id uuid, p_reversal_of uuid, p_created_by uuid, p_lines jsonb) RETURNS uuid
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
    entry_id, structure_id, journal, entry_date, account, label, debit, credit, supplier_id, customer_id
  )
  SELECT
    v_entry_id, p_structure_id, p_journal, p_entry_date,
    l->>'account',
    COALESCE(NULLIF(l->>'label', ''), p_label),
    ROUND(COALESCE((l->>'debit')::NUMERIC, 0), 2),
    ROUND(COALESCE((l->>'credit')::NUMERIC, 0), 2),
    NULLIF(l->>'supplier_id', '')::UUID,
    NULLIF(l->>'customer_id', '')::UUID
  FROM jsonb_array_elements(p_lines) AS l;

  RETURN v_entry_id;
END;
$_$;

-- ── Sécurité : service role uniquement ───────────────────
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_document_counters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.customers, public.sales_documents, public.sales_document_lines, public.sales_payments, public.sales_document_counters FROM anon, authenticated;
GRANT ALL ON public.customers, public.sales_documents, public.sales_document_lines, public.sales_payments, public.sales_document_counters TO service_role;

REVOKE ALL ON FUNCTION public.issue_sales_document(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_sales_payment(uuid, numeric, text, date, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sales_document_list_stats(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_accounting_entry(uuid, text, date, text, text, text, uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_sales_document(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_sales_payment(uuid, numeric, text, date, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sales_document_list_stats(uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.post_accounting_entry(uuid, text, date, text, text, text, uuid, uuid, uuid, jsonb) TO service_role;

COMMIT;
