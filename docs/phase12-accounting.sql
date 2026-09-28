-- ============================================================
-- SHEDE ERP — Phase 12 : Comptabilité SYSCOHADA
-- À exécuter dans le SQL Editor de votre projet Supabase
-- Idempotent : peut être exécuté plusieurs fois sans effet de bord.
--
-- Principes :
-- - Partie double : chaque écriture est équilibrée (total débit = total crédit).
-- - Les écritures ne sont jamais modifiées ni supprimées : on les contrepasse.
-- - Numérotation continue par point, journal et année (VE-2026-00001).
-- - Une période clôturée (structures.accounting_locked_until) n'accepte plus
--   d'écriture.
-- - Toutes les écritures passent par post_accounting_entry() (transaction unique).
-- ============================================================

-- 1. Date de clôture de la comptabilité de chaque point
ALTER TABLE structures ADD COLUMN IF NOT EXISTS accounting_locked_until DATE;

-- 2. Sous-comptes propres à un point (le plan SYSCOHADA standard est dans le code)
CREATE TABLE IF NOT EXISTS accounting_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  number VARCHAR(12) NOT NULL CHECK (number ~ '^[1-8][0-9]{1,11}$'),
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (structure_id, number)
);

-- 3. Fournisseurs
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone VARCHAR(30),
  email TEXT,
  niu VARCHAR(50),
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_structure ON suppliers(structure_id);

-- 4. Écritures (en-têtes)
--    Journaux : VE ventes, AC achats, TR trésorerie, OD opérations diverses, AN à-nouveaux
CREATE TABLE IF NOT EXISTS accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  journal VARCHAR(4) NOT NULL CHECK (journal IN ('VE', 'AC', 'TR', 'OD', 'AN')),
  number VARCHAR(30) NOT NULL,
  entry_date DATE NOT NULL,
  label TEXT NOT NULL,
  reference TEXT,
  -- Origine : ORDER, BOOKING, EXPENSE, EXPENSE_PAYMENT, REVERSAL ou MANUAL
  source_type VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
  source_id UUID,
  reversal_of UUID REFERENCES accounting_entries(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (structure_id, number)
);
-- Une seule écriture automatique par document (commande, réservation, dépense…)
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_entries_source
  ON accounting_entries(source_type, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_entries_structure_date
  ON accounting_entries(structure_id, entry_date);

-- 5. Lignes d'écriture (date et journal recopiés pour les états)
CREATE TABLE IF NOT EXISTS accounting_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  journal VARCHAR(4) NOT NULL,
  entry_date DATE NOT NULL,
  account VARCHAR(12) NOT NULL,
  label TEXT NOT NULL,
  debit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  CHECK (debit = 0 OR credit = 0),
  CHECK (debit > 0 OR credit > 0)
);
CREATE INDEX IF NOT EXISTS idx_accounting_lines_structure_date ON accounting_lines(structure_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_accounting_lines_structure_account ON accounting_lines(structure_id, account);
CREATE INDEX IF NOT EXISTS idx_accounting_lines_entry ON accounting_lines(entry_id);

-- 6. Dépenses (factures fournisseurs, charges)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  category VARCHAR(40) NOT NULL,
  account VARCHAR(12) NOT NULL,
  expense_date DATE NOT NULL,
  label TEXT NOT NULL,
  reference TEXT,
  amount_ht NUMERIC(14, 2) NOT NULL CHECK (amount_ht >= 0),
  tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  amount_ttc NUMERIC(14, 2) NOT NULL CHECK (amount_ttc > 0),
  status VARCHAR(12) NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PAID', 'CANCELLED')),
  payment_method VARCHAR(20),
  paid_at DATE,
  attachment_url TEXT,
  entry_id UUID REFERENCES accounting_entries(id),
  payment_entry_id UUID REFERENCES accounting_entries(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_structure_date ON expenses(structure_id, expense_date);

-- 7. Compteurs de numérotation (par point, journal et année)
CREATE TABLE IF NOT EXISTS accounting_counters (
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  journal VARCHAR(4) NOT NULL,
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (structure_id, journal, year)
);

-- 8. Accès : uniquement par le serveur (service_role). Aucune politique = aucun
--    accès pour les clés anon / authenticated.
ALTER TABLE accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_counters ENABLE ROW LEVEL SECURITY;

-- 9. Enregistrement d'une écriture : validation, numérotation et insertion
--    dans une seule transaction.
--    p_lines : [{ "account": "571", "label": "...", "debit": 1000, "credit": 0,
--                 "supplier_id": null }, ...]
--    Idempotente pour les écritures automatiques : si le document source a
--    déjà son écriture, son id est renvoyé sans rien créer.
--    Erreurs (préfixe lisible par l'application) :
--      ACCOUNTING_PERIOD_LOCKED, ACCOUNTING_UNBALANCED, ACCOUNTING_INVALID_LINES
CREATE OR REPLACE FUNCTION public.post_accounting_entry(
  p_structure_id UUID,
  p_journal TEXT,
  p_entry_date DATE,
  p_label TEXT,
  p_reference TEXT,
  p_source_type TEXT,
  p_source_id UUID,
  p_reversal_of UUID,
  p_created_by UUID,
  p_lines JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.post_accounting_entry(UUID, TEXT, DATE, TEXT, TEXT, TEXT, UUID, UUID, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_accounting_entry(UUID, TEXT, DATE, TEXT, TEXT, TEXT, UUID, UUID, UUID, JSONB)
  TO service_role;

-- ============================================================
-- FIN DE LA MIGRATION PHASE 12
-- Activez ensuite le module « Comptabilité » dans la licence de
-- l'organisation (super admin → Organisations → Modifier).
-- ============================================================
