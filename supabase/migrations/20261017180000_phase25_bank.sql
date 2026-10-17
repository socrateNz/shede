-- Phase 25 — Banque : comptes bancaires, import des relevés, rapprochement
--
-- Un compte bancaire (ou Mobile Money) est rattaché à un compte de trésorerie du plan
-- (521, 5211, 552…). Chaque ligne du relevé importé est rapprochée d'une ou plusieurs lignes
-- d'écriture passées sur ce compte (ex. une remise de plusieurs encaissements) dont la somme
-- égale son montant : encaissement (+) ↔ débits, décaissement (−) ↔ crédits.
--
-- Accès : service role uniquement. Rejouable sans erreur.

BEGIN;

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  name text NOT NULL,
  bank_name text,
  account_number text,                       -- RIB / IBAN / numéro Mobile Money
  account varchar(12) NOT NULL DEFAULT '521' CHECK (account ~ '^5[0-9]{1,11}$'),
  -- Solde du relevé au début du suivi (pour calculer le solde bancaire à une date)
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  opening_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Un compte du plan = un seul compte bancaire (sinon le rapprochement serait ambigu)
CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_accounts_account ON public.bank_accounts (structure_id, account);

CREATE TABLE IF NOT EXISTS public.bank_statement_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  file_name text,
  line_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  date_from date,
  date_to date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  import_id uuid REFERENCES public.bank_statement_imports(id) ON DELETE SET NULL,
  value_date date NOT NULL,
  label text NOT NULL,
  reference text,
  amount numeric(14,2) NOT NULL CHECK (amount <> 0), -- + entrée d'argent, − sortie
  status varchar(10) NOT NULL DEFAULT 'UNMATCHED' CHECK (status IN ('UNMATCHED', 'MATCHED', 'IGNORED')),
  accounting_line_id uuid,
  matched_by uuid,
  matched_at timestamptz,
  -- Anti-doublon : un même relevé importé deux fois n'ajoute rien
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_statement_lines_dedupe ON public.bank_statement_lines (bank_account_id, dedupe_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_statement_lines_accounting ON public.bank_statement_lines (accounting_line_id) WHERE accounting_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_list ON public.bank_statement_lines (bank_account_id, status, value_date DESC);

-- Ligne d'écriture rapprochée : le lien est posé côté comptabilité (une ligne d'écriture ne
-- pointe que vers une ligne de relevé ; une ligne de relevé peut regrouper plusieurs écritures).
-- bank_statement_lines.accounting_line_id garde la première, pour l'affichage.
ALTER TABLE public.accounting_lines ADD COLUMN IF NOT EXISTS bank_statement_line_id uuid;
DROP INDEX IF EXISTS public.uq_accounting_lines_bank;
CREATE INDEX IF NOT EXISTS idx_accounting_lines_bank ON public.accounting_lines (bank_statement_line_id) WHERE bank_statement_line_id IS NOT NULL;

-- Compte de trésorerie choisi au paiement (banque précise) ; sinon celui du moyen de paiement
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_account varchar(12);
DO $$
BEGIN
  IF to_regclass('public.sales_payments') IS NOT NULL THEN
    ALTER TABLE public.sales_payments ADD COLUMN IF NOT EXISTS treasury_account varchar(12);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_accounting_lines_unreconciled ON public.accounting_lines (structure_id, account, entry_date) WHERE bank_statement_line_id IS NULL;

-- Rapprochement d'une ligne de relevé avec une ou plusieurs lignes d'écriture : mêmes point
-- et compte, même sens, somme égale au montant du relevé, aucune déjà rapprochée.
DROP FUNCTION IF EXISTS public.match_bank_line(uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.match_bank_lines(p_statement_line_id uuid, p_accounting_line_ids uuid[], p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_line bank_statement_lines%ROWTYPE;
  v_bank bank_accounts%ROWTYPE;
  v_count integer;
  v_valid integer;
  v_debit numeric;
  v_credit numeric;
BEGIN
  SELECT * INTO v_line FROM bank_statement_lines WHERE id = p_statement_line_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BANK_LINE_NOT_FOUND'; END IF;
  IF v_line.status <> 'UNMATCHED' THEN RAISE EXCEPTION 'BANK_LINE_ALREADY_MATCHED'; END IF;
  SELECT * INTO v_bank FROM bank_accounts WHERE id = v_line.bank_account_id;
  v_count := COALESCE(array_length(p_accounting_line_ids, 1), 0);
  IF v_count = 0 OR v_count > 100 THEN RAISE EXCEPTION 'BANK_MATCH_INVALID'; END IF;

  -- Verrou et contrôles sur les lignes d'écriture choisies
  PERFORM 1 FROM accounting_lines WHERE id = ANY (p_accounting_line_ids) FOR UPDATE;
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE structure_id = v_line.structure_id AND account = v_bank.account AND bank_statement_line_id IS NULL),
         COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO v_valid, v_count, v_debit, v_credit
  FROM accounting_lines WHERE id = ANY (p_accounting_line_ids);
  IF v_valid <> array_length(p_accounting_line_ids, 1) OR v_count <> v_valid THEN
    RAISE EXCEPTION 'BANK_MATCH_INVALID';
  END IF;
  -- Même sens pour toutes les lignes, et somme égale au montant du relevé
  IF (v_line.amount > 0 AND (v_credit <> 0 OR v_debit <> v_line.amount))
     OR (v_line.amount < 0 AND (v_debit <> 0 OR v_credit <> -v_line.amount)) THEN
    RAISE EXCEPTION 'BANK_MATCH_AMOUNT';
  END IF;

  UPDATE bank_statement_lines
  SET status = 'MATCHED', accounting_line_id = p_accounting_line_ids[1], matched_by = p_user, matched_at = now()
  WHERE id = p_statement_line_id;
  UPDATE accounting_lines SET bank_statement_line_id = p_statement_line_id WHERE id = ANY (p_accounting_line_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.unmatch_bank_line(p_statement_line_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_line bank_statement_lines%ROWTYPE;
BEGIN
  SELECT * INTO v_line FROM bank_statement_lines WHERE id = p_statement_line_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BANK_LINE_NOT_FOUND'; END IF;
  UPDATE accounting_lines SET bank_statement_line_id = NULL WHERE bank_statement_line_id = p_statement_line_id;
  UPDATE bank_statement_lines
  SET status = 'UNMATCHED', accounting_line_id = NULL, matched_by = NULL, matched_at = NULL
  WHERE id = p_statement_line_id;
END;
$$;

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bank_accounts, public.bank_statement_imports, public.bank_statement_lines FROM anon, authenticated;
GRANT ALL ON public.bank_accounts, public.bank_statement_imports, public.bank_statement_lines TO service_role;
REVOKE ALL ON FUNCTION public.match_bank_lines(uuid, uuid[], uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unmatch_bank_line(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_bank_lines(uuid, uuid[], uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.unmatch_bank_line(uuid) TO service_role;

COMMIT;
