-- Vérifications après 05-enable-rls.sql

-- 1. RLS activé
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'structures', 'users', 'licenses', 'products', 'orders', 'promotions'
  )
ORDER BY tablename;

-- 2. Comportement anon (à exécuter en une session)
-- SET ROLE anon;
-- SELECT count(*) AS structures_visibles FROM public.structures;
-- SELECT count(*) AS users_visibles FROM public.users;  -- attendu : 0
-- RESET ROLE;
