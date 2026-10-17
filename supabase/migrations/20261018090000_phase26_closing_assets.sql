-- Phase 26 — Clôture d'exercice et immobilisations
--
-- Exercices : la clôture solde les comptes de charges et de produits (6, 7, 8) vers le
-- résultat (131 bénéfice / 139 perte) par une écriture datée du dernier jour, puis verrouille
-- la période. Le grand livre étant cumulatif, aucun « à-nouveau » n'est nécessaire : les
-- soldes de bilan se reportent d'eux-mêmes.
--
-- Immobilisations : fiche par bien, amortissement linéaire prorata temporis, dotations
-- passées en écriture (681 / 28x) et mémorisées pour ne jamais être passées deux fois.
--
-- Accès : service role uniquement. Rejouable sans erreur.

BEGIN;

CREATE TABLE IF NOT EXISTS public.fiscal_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status varchar(8) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  result numeric(14,2),
  closing_entry_id uuid,
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_years_start ON public.fiscal_years (structure_id, start_date);

CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  name text NOT NULL,
  category varchar(20) NOT NULL,
  asset_account varchar(12) NOT NULL CHECK (asset_account ~ '^2[0-9]{1,11}$'),
  depreciation_account varchar(12) CHECK (depreciation_account ~ '^28[0-9]{0,10}$'),
  expense_account varchar(12) NOT NULL DEFAULT '681',
  acquisition_date date NOT NULL,
  in_service_date date NOT NULL,
  cost numeric(14,2) NOT NULL CHECK (cost > 0),          -- valeur d'origine HT
  useful_life_months integer NOT NULL CHECK (useful_life_months >= 0), -- 0 = non amortissable (terrain)
  supplier_id uuid,
  reference text,
  notes text,
  status varchar(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISPOSED')),
  disposed_at date,
  acquisition_entry_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (in_service_date >= acquisition_date)
);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_structure ON public.fixed_assets (structure_id, status);

CREATE TABLE IF NOT EXISTS public.fixed_asset_depreciations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  period_end date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  entry_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Une seule dotation par bien et par date d'arrêté
CREATE UNIQUE INDEX IF NOT EXISTS uq_fixed_asset_depreciations ON public.fixed_asset_depreciations (asset_id, period_end);

ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_asset_depreciations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fiscal_years, public.fixed_assets, public.fixed_asset_depreciations FROM anon, authenticated;
GRANT ALL ON public.fiscal_years, public.fixed_assets, public.fixed_asset_depreciations TO service_role;

COMMIT;
