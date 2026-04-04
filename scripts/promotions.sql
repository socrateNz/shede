-- ############################################################################
-- # MODULE: PROMOTION (Discount & Offers System)
-- # PROJECT: Shede SaaS
-- # DESCRIPTION: Implementation of flexible promotion and discount system
-- ############################################################################

-- 1. PROMOTIONS TABLE
-- Stores the promotion definitions (Type, Value, Scope, etc.)
CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('PERCENTAGE', 'FIXED')),
    value NUMERIC NOT NULL CHECK (value >= 0),
    scope TEXT NOT NULL CHECK (scope IN ('PRODUCT', 'ORDER')),
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    min_order_amount NUMERIC DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    structure_id UUID NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Constraint: product_id is required if scope is PRODUCT
    CONSTRAINT check_product_scope CHECK (
        (scope = 'PRODUCT' AND product_id IS NOT NULL) OR 
        (scope = 'ORDER')
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_promotions_structure_id ON public.promotions(structure_id);
CREATE INDEX IF NOT EXISTS idx_promotions_is_active ON public.promotions(is_active);

-- 2. PROMO CODES TABLE
-- Stores specific codes linked to a promotion
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
    usage_limit INTEGER, -- NULL means unlimited
    used_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Unique code per structure (or global unique depending on business need)
    -- Here we enforce global uniqueness as requested "code (text unique)"
    CONSTRAINT promo_codes_code_key UNIQUE (code)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_promo_codes_promotion_id ON public.promo_codes(promotion_id);

-- 3. PROMO CODE USAGES TABLE
-- Ensures one-time usage per user and tracks consumption
CREATE TABLE IF NOT EXISTS public.promo_code_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- VERY IMPORTANT: Unique constraint to prevent same user from using same code twice
    CONSTRAINT promo_code_user_unique UNIQUE (promo_code_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_promo_code_usages_promo_code_id ON public.promo_code_usages(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_usages_user_id ON public.promo_code_usages(user_id);

-- 4. MODIFY ORDERS TABLE
-- Add support for tracking applied promotions on orders
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'promotion_id') THEN
        ALTER TABLE public.orders ADD COLUMN promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'discount_amount') THEN
        ALTER TABLE public.orders ADD COLUMN discount_amount NUMERIC DEFAULT 0;
    END IF;
END $$;

-- 5. RLS POLICIES (Assuming existing RLS structure)
-- Enable RLS and add basic structure-based filtering

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_usages ENABLE ROW LEVEL SECURITY;

-- Dynamic policies based on structure_id (replace with your actual auth claim if different)
-- Example assuming 'structure_id' is in jwt claims or we filter by user's structure
CREATE POLICY "Users can view their structure's promotions" ON public.promotions
    FOR SELECT USING (structure_id = (SELECT structure_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage their structure's promotions" ON public.promotions
    FOR ALL USING (structure_id = (SELECT structure_id FROM public.users WHERE id = auth.uid()));
