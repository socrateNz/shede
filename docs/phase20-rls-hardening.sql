-- Phase 20 : fermeture des policies ouvertes de la phase 2.
--
-- « Enable all … » donnait à tout le monde (rôle public, donc aussi anon avec
-- la clé publique du navigateur) lecture ET écriture sur les tables clients
-- et tables. L'application n'y accède qu'avec la clé service_role côté
-- serveur, qui ignore la RLS : on supprime ces policies sans rien remplacer.

DROP POLICY IF EXISTS "Enable all for users based on structure_id for clients" ON public.clients;
DROP POLICY IF EXISTS "Enable all for users based on structure_id for tables" ON public.tables;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
