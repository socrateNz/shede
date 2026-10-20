-- ============================================================================
-- Démonstration « La vallé de Bana » : restaurant-bar-hôtel camerounais (Dschang)
-- qui utilise Shede depuis 3 mois. Remplace l'activité et le catalogue du point
-- et garde : comptes existants, licence, chambres, tables, salles, téléphones
-- serveurs, clés API.
--
-- Les numéros (factures, commandes fournisseurs, réceptions, écritures) et les
-- opérations de stock (réceptions, inventaires) passent par les fonctions SQL de
-- l'application ; ventes, sorties de stock et écritures reproduisent son code
-- (lib/stock.ts, lib/order-totals.ts, lib/accounting/posting.ts).
-- Dates relatives au jour d'exécution (90 jours jusqu'à aujourd'hui, heure de Douala).
-- Une seule transaction : à la moindre erreur, rien n'est modifié. Relançable.
--
-- Usage (mot de passe des comptes de démonstration lu dans un fichier, jamais écrit ici) :
--   psql -U supabase_admin -v ON_ERROR_STOP=1 -v mot_de_passe_demo="$(cat fichier)" -f demo-la-vallee-de-bana.sql
-- (superutilisateur requis : les dates historiques sont rétablies sans déclencheur).
-- Sans mot de passe : comptes créés mais inutilisables (mot de passe aléatoire).
-- ============================================================================

\set ON_ERROR_STOP on
SET client_min_messages = notice;
SET search_path = public, extensions;

\if :{?mot_de_passe_demo}
SELECT set_config('demo.mot_de_passe', :'mot_de_passe_demo', false) IS NOT NULL AS mot_de_passe_fourni;
\else
SELECT set_config('demo.mot_de_passe', encode(gen_random_bytes(18), 'base64'), false) IS NULL AS mot_de_passe_fourni;
\endif

BEGIN;
SELECT setseed(0.2026);

-- ── Contexte ─────────────────────────────────────────────────────────────────

CREATE TEMP TABLE demo_ctx ON COMMIT DROP AS
SELECT s.id AS sid,
       s.organization_id AS org_id,
       COALESCE(NULLIF(s.tax_rate, 0), 19.25)::numeric AS rate,
       COALESCE(s.takeaway_fee, 0)::numeric AS takeaway_fee,
       (now() AT TIME ZONE 'Africa/Douala')::date AS t_end,
       (now() AT TIME ZONE 'Africa/Douala')::date - 90 AS t_start,
       now() AS t_now,
       (SELECT u.id FROM users u WHERE u.structure_id = s.id AND u.role = 'ADMIN' ORDER BY u.created_at LIMIT 1) AS admin_id
FROM structures s
WHERE s.name = 'La vallé de Bana';

DO $$
BEGIN
  IF (SELECT count(*) FROM demo_ctx) <> 1 THEN
    RAISE EXCEPTION 'Point « La vallé de Bana » introuvable ou en double : rien n''est modifié';
  END IF;
  IF (SELECT admin_id FROM demo_ctx) IS NULL THEN
    RAISE EXCEPTION 'Aucun administrateur rattaché au point : rien n''est modifié';
  END IF;
  IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'Lancer avec psql -U supabase_admin (dates historiques à rétablir sans déclencheur) : rien n''est modifié';
  END IF;
  IF (SELECT count(*) FROM rooms r, demo_ctx c WHERE r.structure_id = c.sid) = 0 THEN
    RAISE EXCEPTION 'Aucune chambre dans le point : rien n''est modifié';
  END IF;
END $$;

CREATE FUNCTION pg_temp.sid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT sid FROM demo_ctx $$;
CREATE FUNCTION pg_temp.at(d date, minutes double precision) RETURNS timestamptz LANGUAGE sql IMMUTABLE AS
$$ SELECT (d + make_interval(secs => minutes * 60)) AT TIME ZONE 'Africa/Douala' $$;
CREATE FUNCTION pg_temp.rint(a int, b int) RETURNS int LANGUAGE sql VOLATILE AS
$$ SELECT a + floor(random() * (b - a + 1))::int $$;
CREATE FUNCTION pg_temp.chance(p numeric) RETURNS boolean LANGUAGE sql VOLATILE AS $$ SELECT random() < p $$;
CREATE FUNCTION pg_temp.pick(arr text[]) RETURNS text LANGUAGE sql VOLATILE AS
$$ SELECT arr[1 + floor(random() * array_length(arr, 1))::int] $$;
CREATE FUNCTION pg_temp.ddate(ts timestamptz) RETURNS date LANGUAGE sql IMMUTABLE AS
$$ SELECT (ts AT TIME ZONE 'Africa/Douala')::date $$;

-- ── Remise à zéro de l'activité et du catalogue du point ─────────────────────

DELETE FROM bank_statement_lines WHERE structure_id = pg_temp.sid();
DELETE FROM bank_statement_imports WHERE structure_id = pg_temp.sid();
DELETE FROM sales_payments WHERE structure_id = pg_temp.sid();
DELETE FROM sales_document_lines WHERE document_id IN (SELECT id FROM sales_documents WHERE structure_id = pg_temp.sid());
UPDATE sales_documents SET source_document_id = NULL WHERE structure_id = pg_temp.sid();
DELETE FROM sales_documents WHERE structure_id = pg_temp.sid();
DELETE FROM sales_document_counters WHERE structure_id = pg_temp.sid();
DELETE FROM fixed_asset_depreciations WHERE structure_id = pg_temp.sid();
DELETE FROM fixed_assets WHERE structure_id = pg_temp.sid();
DELETE FROM fiscal_years WHERE structure_id = pg_temp.sid();
DELETE FROM expenses WHERE structure_id = pg_temp.sid();
DELETE FROM accounting_entries WHERE structure_id = pg_temp.sid();
DELETE FROM accounting_counters WHERE structure_id = pg_temp.sid();
DELETE FROM accounting_accounts WHERE structure_id = pg_temp.sid();
DELETE FROM goods_receipt_lines WHERE receipt_id IN (SELECT id FROM goods_receipts WHERE structure_id = pg_temp.sid());
DELETE FROM goods_receipts WHERE structure_id = pg_temp.sid();
DELETE FROM purchase_order_lines WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE structure_id = pg_temp.sid());
DELETE FROM purchase_orders WHERE structure_id = pg_temp.sid();
DELETE FROM purchase_counters WHERE structure_id = pg_temp.sid();
DELETE FROM supplier_items WHERE structure_id = pg_temp.sid();
DELETE FROM order_submissions WHERE structure_id = pg_temp.sid();
DELETE FROM webhook_deliveries WHERE structure_id = pg_temp.sid();
DELETE FROM order_accompaniments WHERE order_id IN (SELECT id FROM orders WHERE structure_id = pg_temp.sid());
DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE structure_id = pg_temp.sid());
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE structure_id = pg_temp.sid());
DELETE FROM orders WHERE structure_id = pg_temp.sid();
DELETE FROM notifications WHERE structure_id = pg_temp.sid();
DELETE FROM forecast_snapshots WHERE structure_id = pg_temp.sid();
DELETE FROM forecast_events WHERE structure_id = pg_temp.sid();
DELETE FROM inventory_lines WHERE inventory_id IN (SELECT id FROM inventories WHERE structure_id = pg_temp.sid());
DELETE FROM inventories WHERE structure_id = pg_temp.sid();
DELETE FROM stock_movements WHERE structure_id = pg_temp.sid();
DELETE FROM stocks WHERE structure_id = pg_temp.sid();
DELETE FROM recipe_items WHERE structure_id = pg_temp.sid();
DELETE FROM product_recipes WHERE structure_id = pg_temp.sid() OR product_id IN (SELECT id FROM products WHERE structure_id = pg_temp.sid());
DELETE FROM product_accompaniments WHERE structure_id = pg_temp.sid();
DELETE FROM product_category_links WHERE product_id IN (SELECT id FROM products WHERE structure_id = pg_temp.sid());
DELETE FROM promo_code_usages WHERE promo_code_id IN (SELECT pc.id FROM promo_codes pc JOIN promotions p ON p.id = pc.promotion_id WHERE p.structure_id = pg_temp.sid());
DELETE FROM promo_codes WHERE promotion_id IN (SELECT id FROM promotions WHERE structure_id = pg_temp.sid());
DELETE FROM promotions WHERE structure_id = pg_temp.sid();
DELETE FROM suppliers WHERE structure_id = pg_temp.sid();
DELETE FROM products WHERE structure_id = pg_temp.sid();
DELETE FROM accompaniments WHERE structure_id = pg_temp.sid();
DELETE FROM ingredients WHERE structure_id = pg_temp.sid();
DELETE FROM product_categories WHERE structure_id = pg_temp.sid() AND parent_id IS NOT NULL;
DELETE FROM product_categories WHERE structure_id = pg_temp.sid();
DELETE FROM delivery_zones WHERE structure_id = pg_temp.sid();
DELETE FROM customers WHERE structure_id = pg_temp.sid();
DELETE FROM clients WHERE structure_id = pg_temp.sid();
DELETE FROM shifts WHERE structure_id = pg_temp.sid();
DELETE FROM bookings WHERE room_id IN (SELECT id FROM rooms WHERE structure_id = pg_temp.sid());
DELETE FROM bank_accounts WHERE structure_id = pg_temp.sid();
DELETE FROM users WHERE structure_id = pg_temp.sid() AND email LIKE '%@labanavallee.demo';
UPDATE structures SET invoice_counter = 0, accounting_locked_until = NULL WHERE id = pg_temp.sid();
UPDATE rooms SET status = 'AVAILABLE' WHERE structure_id = pg_temp.sid();
UPDATE tables SET status = 'AVAILABLE' WHERE structure_id = pg_temp.sid();

-- ── Équipe de démonstration ──────────────────────────────────────────────────

CREATE TEMP TABLE demo_users ON COMMIT DROP AS
SELECT v.k, gen_random_uuid() AS id, v.role, v.first_name, v.last_name, v.email
FROM (VALUES
  ('caisse1', 'CAISSE', 'Aline', 'Mbarga', 'aline.caisse@labanavallee.demo'),
  ('caisse2', 'CAISSE', 'Brice', 'Tchinda', 'brice.caisse@labanavallee.demo'),
  ('serveur1', 'SERVEUR', 'Prisca', 'Ngo Ndjock', 'prisca.serveuse@labanavallee.demo'),
  ('serveur2', 'SERVEUR', 'Junior', 'Fotso', 'junior.serveur@labanavallee.demo'),
  ('serveur3', 'SERVEUR', 'Carine', 'Kenfack', 'carine.serveuse@labanavallee.demo'),
  ('cuisine', 'CUISINIER', 'Odile', 'Tsafack', 'odile.cuisine@labanavallee.demo'),
  ('bar', 'BAR', 'Rodrigue', 'Nana', 'rodrigue.bar@labanavallee.demo'),
  ('livreur', 'LIVREUR', 'Hervé', 'Djoumessi', 'herve.livraison@labanavallee.demo'),
  ('magasin', 'MAGASINIER', 'Paul', 'Ateba', 'paul.magasin@labanavallee.demo'),
  ('compta', 'COMPTABLE', 'Sandrine', 'Ewane', 'sandrine.compta@labanavallee.demo'),
  ('gerant', 'MANAGER', 'Gaston', 'Momo', 'gaston.gerant@labanavallee.demo'),
  ('direction', 'ADMIN', 'Florence', 'Kamga', 'florence.direction@labanavallee.demo'),
  ('reception', 'RECEPTION', 'Mireille', 'Tagne', 'mireille.reception@labanavallee.demo')
) AS v(k, role, first_name, last_name, email);

INSERT INTO users (id, structure_id, organization_id, email, password_hash, first_name, last_name, role, locale, created_at, updated_at)
SELECT u.id, c.sid, c.org_id, u.email, crypt(current_setting('demo.mot_de_passe'), gen_salt('bf', 10)),
       u.first_name, u.last_name, u.role, 'fr', pg_temp.at(c.t_start - 7, 600), pg_temp.at(c.t_start - 7, 600)
FROM demo_users u, demo_ctx c;

CREATE FUNCTION pg_temp.uid(key text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM demo_users WHERE k = key $$;

-- ── Catalogue ────────────────────────────────────────────────────────────────

CREATE TEMP TABLE demo_cat ON COMMIT DROP AS
SELECT v.name, v.pos, gen_random_uuid() AS id
FROM (VALUES ('Plats', 1), ('Grillades', 2), ('Petit-déjeuner', 3), ('Desserts', 4),
             ('Bières', 5), ('Boissons fraîches', 6), ('Vins & spiritueux', 7), ('Boissons chaudes', 8)) AS v(name, pos);
INSERT INTO product_categories (id, structure_id, name, position, is_active, created_at)
SELECT id, pg_temp.sid(), name, pos, true, pg_temp.at((SELECT t_start FROM demo_ctx) - 7, 620) FROM demo_cat;

-- pool : groupe de choix (plat, grillade, petit-déjeuner, dessert, bière, boisson, vin, chaud)
-- weight : popularité ; accomp : choix d'accompagnement ; sup/pack_* : achat (produits revendus en l'état)
CREATE TEMP TABLE demo_prod ON COMMIT DROP AS
SELECT v.*, gen_random_uuid() AS id, 0::numeric AS exp_daily
FROM (VALUES
  ('Ndolé aux crevettes', 'Feuilles de ndolé, arachides, crevettes et poisson fumé', 3500, 'CUISINE', 'Plats', 'plat', 9.0, true, true, NULL::numeric, NULL, NULL, NULL::numeric),
  ('Poulet DG', 'Poulet sauté aux plantains mûrs et légumes', 5000, 'CUISINE', 'Plats', 'plat', 10.0, false, true, NULL, NULL, NULL, NULL),
  ('Eru et water fufu', 'Eru, waterleaf, viande et poisson fumé, deux boules de water fufu', 3000, 'CUISINE', 'Plats', 'plat', 6.0, false, true, NULL, NULL, NULL, NULL),
  ('Okok sucré', 'Feuilles d''okok à la pâte d''arachide', 2500, 'CUISINE', 'Plats', 'plat', 4.0, true, true, NULL, NULL, NULL, NULL),
  ('Kondrè de chèvre', 'Ragoût de chèvre aux plantains verts', 4000, 'CUISINE', 'Plats', 'plat', 5.0, false, true, NULL, NULL, NULL, NULL),
  ('Taro sauce jaune', 'Taro pilé, sauce jaune à l''huile de palme et viande', 3000, 'CUISINE', 'Plats', 'plat', 4.0, false, true, NULL, NULL, NULL, NULL),
  ('Sauce gombo et couscous maïs', 'Sauce gombo à la viande, couscous de maïs', 2500, 'CUISINE', 'Plats', 'plat', 4.0, false, true, NULL, NULL, NULL, NULL),
  ('Spaghetti sautés', 'Spaghetti sautés aux légumes et à l''œuf', 2000, 'CUISINE', 'Plats', 'plat', 4.0, false, true, NULL, NULL, NULL, NULL),
  ('Poisson braisé', 'Bar braisé au feu de bois, piment et citron', 5500, 'CUISINE', 'Grillades', 'plat', 8.0, true, true, NULL, NULL, NULL, NULL),
  ('Poulet braisé (½)', 'Demi-poulet mariné et braisé', 4500, 'CUISINE', 'Grillades', 'plat', 7.0, true, true, NULL, NULL, NULL, NULL),
  ('Brochettes de bœuf (×4)', 'Quatre brochettes de bœuf épicées', 2000, 'CUISINE', 'Grillades', 'plat', 7.0, true, true, NULL, NULL, NULL, NULL),
  ('Soya de bœuf', 'Soya au piment et oignons', 1500, 'CUISINE', 'Grillades', 'plat', 8.0, false, true, NULL, NULL, NULL, NULL),
  ('Omelette et pain', 'Omelette de trois œufs, tomate, oignon et pain', 1500, 'CUISINE', 'Petit-déjeuner', 'matin', 5.0, false, true, NULL, NULL, NULL, NULL),
  ('Beignets haricots bouillie', 'Beignets, haricots rouges et bouillie', 1000, 'CUISINE', 'Petit-déjeuner', 'matin', 6.0, false, true, NULL, NULL, NULL, NULL),
  ('Salade de fruits', 'Fruits frais de saison', 1500, 'CUISINE', 'Desserts', 'dessert', 4.0, false, true, NULL, NULL, NULL, NULL),
  ('33 Export (65 cl)', NULL, 800, 'BAR', 'Bières', 'biere', 10.0, false, false, 560, 'sabc', 'Casier (12 bouteilles)', 12),
  ('Castel Beer (65 cl)', NULL, 800, 'BAR', 'Bières', 'biere', 9.0, false, false, 560, 'sabc', 'Casier (12 bouteilles)', 12),
  ('Mützig (65 cl)', NULL, 800, 'BAR', 'Bières', 'biere', 6.0, false, false, 580, 'sabc', 'Casier (12 bouteilles)', 12),
  ('Beaufort Light (33 cl)', NULL, 700, 'BAR', 'Bières', 'biere', 3.0, false, false, 450, 'sabc', 'Casier (24 bouteilles)', 24),
  ('Guinness (33 cl)', NULL, 1000, 'BAR', 'Bières', 'biere', 7.0, false, false, 700, 'fotso', 'Casier (24 bouteilles)', 24),
  ('Top Pamplemousse (35 cl)', NULL, 500, 'BAR', 'Boissons fraîches', 'boisson', 6.0, false, true, 300, 'sabc', 'Casier (24 bouteilles)', 24),
  ('Djino Cocktail (35 cl)', NULL, 500, 'BAR', 'Boissons fraîches', 'boisson', 5.0, false, true, 300, 'sabc', 'Casier (24 bouteilles)', 24),
  ('Coca-Cola (35 cl)', NULL, 600, 'BAR', 'Boissons fraîches', 'boisson', 5.0, false, true, 350, 'sabc', 'Casier (24 bouteilles)', 24),
  ('Supermont (1,5 l)', NULL, 700, 'BAR', 'Boissons fraîches', 'boisson', 7.0, false, true, 420, 'fotso', 'Pack (6 bouteilles)', 6),
  ('Jus de foléré maison', 'Bissap maison, servi frais', 1000, 'BAR', 'Boissons fraîches', 'boisson', 5.0, false, true, NULL, NULL, NULL, NULL),
  ('Cocktail La Vallée (sans alcool)', 'Fruits frais mixés, citron', 2500, 'BAR', 'Boissons fraîches', 'boisson', 2.0, false, true, NULL, NULL, NULL, NULL),
  ('Vin rouge (verre)', NULL, 1500, 'BAR', 'Vins & spiritueux', 'vin', 3.0, false, false, 500, 'fotso', 'Carton (6 bouteilles, 36 verres)', 36),
  ('Whisky (verre)', NULL, 2500, 'BAR', 'Vins & spiritueux', 'vin', 2.0, false, false, 900, 'fotso', 'Bouteille (20 verres)', 20),
  ('Café', 'Café filtre, sucre et lait', 700, 'BAR', 'Boissons chaudes', 'chaud', 6.0, false, true, NULL, NULL, NULL, NULL),
  ('Citronnelle', 'Infusion de citronnelle au citron', 500, 'BAR', 'Boissons chaudes', 'chaud', 2.0, false, true, NULL, NULL, NULL, NULL)
) AS v(name, description, price, dest, cat, pool, weight, accomp, deliverable, cost, sup, pack_label, pack_size);

INSERT INTO products (id, structure_id, name, description, price, category, destination, is_available, is_deleted, is_deliverable, purchase_cost, created_at, updated_at)
SELECT p.id, pg_temp.sid(), p.name, p.description, p.price, p.cat, p.dest, true, false, p.deliverable, p.cost,
       pg_temp.at((SELECT t_start FROM demo_ctx) - 7, 640), pg_temp.at((SELECT t_start FROM demo_ctx) - 7, 640)
FROM demo_prod p;
INSERT INTO product_category_links (product_id, category_id)
SELECT p.id, c.id FROM demo_prod p JOIN demo_cat c ON c.name = p.cat;

-- Photos des produits et des chambres : photos libres (Wikimedia Commons, CC BY / BY-SA / CC0),
-- auteurs et licences dans deploy/demo/credits-photos.md ; chambres : seulement si elles n'ont pas de photo.
UPDATE products p SET image_url = v.url
FROM (VALUES
  ('Ndolé aux crevettes', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509283/fmlj42agmlh8fp3gmhoj.jpg'),
  ('Poulet DG', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509285/j9bfitxmu7t7yqcebkit.jpg'),
  ('Eru et water fufu', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509289/zxuysifoko8tgubg6xbz.jpg'),
  ('Okok sucré', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509292/poenyf5ojwgojdd9fyyo.jpg'),
  ('Kondrè de chèvre', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509295/o2yjbbxcg7qifaiqmhai.jpg'),
  ('Taro sauce jaune', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509297/qhr3dbfs96b6xylnt0ey.jpg'),
  ('Sauce gombo et couscous maïs', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509299/c7gn3zby52mdlk9t9w1n.jpg'),
  ('Spaghetti sautés', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509301/jqm1pizcy473itkhbjwx.jpg'),
  ('Poisson braisé', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509303/xjkloul0jmsybnzwdpy8.jpg'),
  ('Poulet braisé (½)', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509305/vbkonxnbadtq2fc8vb22.jpg'),
  ('Brochettes de bœuf (×4)', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509307/aysgvcsmjs7sxt8gmhc8.jpg'),
  ('Soya de bœuf', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509309/gxtp8qnmayx4jhgahiuc.jpg'),
  ('Omelette et pain', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509311/cguy8pvudxz1qn2cfbah.jpg'),
  ('Beignets haricots bouillie', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509313/garvygqzrdpxz7krcj7m.jpg'),
  ('Salade de fruits', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509314/hccxwkvus4acxasrewzy.jpg'),
  ('33 Export (65 cl)', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509316/fmoaw5rgvb45ymteygjv.jpg'),
  ('Castel Beer (65 cl)', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509318/rca5az1qufv7ylsn7xwk.jpg'),
  ('Mützig (65 cl)', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509320/t7lnautpgl9ovrzm5yiu.jpg'),
  ('Beaufort Light (33 cl)', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509321/joj0kkn3zccy8dul9dw7.jpg'),
  ('Guinness (33 cl)', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509324/uvc8samxpx9vfizugr2a.jpg'),
  ('Top Pamplemousse (35 cl)', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509326/hybz91ryglmaxcbyhvaj.jpg'),
  ('Djino Cocktail (35 cl)', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509328/qup9tacqhuaaug6iiu5l.jpg'),
  ('Coca-Cola (35 cl)', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509330/p7zjuzuf9hlzelbqqcdu.jpg'),
  ('Supermont (1,5 l)', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509333/z4po30vrixlbtpdq02o4.jpg'),
  ('Jus de foléré maison', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509336/wbw50u3o9ixcvyhwo3ln.jpg'),
  ('Cocktail La Vallée (sans alcool)', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509338/yqeeqopqgotay8rtlhnt.jpg'),
  ('Vin rouge (verre)', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509340/b6wn0s0jw82ligwddkhi.jpg'),
  ('Whisky (verre)', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509342/vblpieclqeq6tpqma1wj.jpg'),
  ('Café', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509344/amzn6elxec3ha3pzbzum.jpg'),
  ('Citronnelle', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509347/ntopjdld9fmc9gfivunl.jpg')
) AS v(name, url)
WHERE p.structure_id = pg_temp.sid() AND p.name = v.name;
UPDATE rooms r SET images = ARRAY[v.url]
FROM (VALUES
  ('CH1', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509349/wwnt2p7npkmlitjh0abr.jpg'),
  ('CH2', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509351/r5i6ciy9juf0ndrahgu2.jpg'),
  ('CH3', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509353/bsx41l2k6ifwzfee0ncb.jpg'),
  ('CH4', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509356/kkdtmq8emoo0y7czwl6w.jpg'),
  ('CH5', 'https://res.cloudinary.com/dxmstltmd/image/upload/v1792509359/ot6pozjcdkf5yvmgqfv0.jpg')
) AS v(number, url)
WHERE r.structure_id = pg_temp.sid() AND r.number = v.number AND COALESCE(cardinality(r.images), 0) = 0;

CREATE TEMP TABLE demo_acc ON COMMIT DROP AS
SELECT v.*, gen_random_uuid() AS id, 0::numeric AS exp_daily
FROM (VALUES ('Plantain mûr frit', 500, 35.0), ('Frites de pommes', 1000, 25.0), ('Riz blanc', 500, 15.0),
             ('Miondo (3 bâtons)', 300, 15.0), ('Bâton de manioc', 300, 10.0)) AS v(name, price, weight);
INSERT INTO accompaniments (id, structure_id, name, price, is_available, is_deleted, created_at, updated_at)
SELECT a.id, pg_temp.sid(), a.name, a.price, true, false, (pg_temp.at((SELECT t_start FROM demo_ctx) - 7, 650)) AT TIME ZONE 'Africa/Douala', (pg_temp.at((SELECT t_start FROM demo_ctx) - 7, 650)) AT TIME ZONE 'Africa/Douala'
FROM demo_acc a;
INSERT INTO product_accompaniments (structure_id, product_id, accompaniment_id, quantity)
SELECT pg_temp.sid(), p.id, a.id, 1 FROM demo_prod p CROSS JOIN demo_acc a WHERE p.accomp;

-- Ingrédients : unité de stock, coût, fournisseur et conditionnement d'achat
CREATE TEMP TABLE demo_ing ON COMMIT DROP AS
SELECT v.*, gen_random_uuid() AS id, 0::numeric AS exp_daily
FROM (VALUES
  ('Feuilles de ndolé lavées', 'kg', 1500, 'marche', 'Seau (5 kg)', 5),
  ('Arachides crues', 'kg', 1300, 'marche', 'Sac (10 kg)', 10),
  ('Oignons', 'kg', 900, 'marche', 'Filet (5 kg)', 5),
  ('Tomates', 'kg', 800, 'marche', 'Cageot (10 kg)', 10),
  ('Piment', 'kg', 2000, 'marche', 'Sachet (1 kg)', 1),
  ('Ail et gingembre', 'kg', 2500, 'marche', 'Sachet (1 kg)', 1),
  ('Plantain mûr', 'piece', 150, 'marche', 'Régime (40 doigts)', 40),
  ('Plantain vert', 'piece', 125, 'marche', 'Régime (40 doigts)', 40),
  ('Eru émincé', 'kg', 2500, 'marche', 'Sac (5 kg)', 5),
  ('Waterleaf', 'kg', 700, 'marche', 'Botte (5 kg)', 5),
  ('Feuilles d''okok', 'kg', 2200, 'marche', 'Sac (5 kg)', 5),
  ('Taro', 'kg', 650, 'marche', 'Sac (25 kg)', 25),
  ('Gombo', 'kg', 1200, 'marche', 'Panier (5 kg)', 5),
  ('Farine de maïs', 'kg', 650, 'marche', 'Sac (25 kg)', 25),
  ('Water fufu (boule)', 'piece', 150, 'marche', 'Lot (20 boules)', 20),
  ('Pommes de terre', 'kg', 600, 'marche', 'Sac (25 kg)', 25),
  ('Bâtons de manioc', 'piece', 100, 'marche', 'Paquet (50)', 50),
  ('Miondo', 'piece', 50, 'marche', 'Paquet (50)', 50),
  ('Haricots rouges', 'kg', 1000, 'marche', 'Sac (10 kg)', 10),
  ('Fruits de saison', 'kg', 900, 'marche', 'Cageot (10 kg)', 10),
  ('Citrons', 'piece', 50, 'marche', 'Filet (50)', 50),
  ('Folérés secs', 'kg', 2500, 'marche', 'Sachet (1 kg)', 1),
  ('Huile de palme', 'l', 1400, 'marche', 'Bidon (5 l)', 5),
  ('Charbon de bois', 'kg', 250, 'marche', 'Sac (25 kg)', 25),
  ('Huile végétale', 'l', 1700, 'epicerie', 'Bidon (20 l)', 20),
  ('Riz parfumé', 'kg', 750, 'epicerie', 'Sac (25 kg)', 25),
  ('Sucre', 'kg', 850, 'epicerie', 'Sac (10 kg)', 10),
  ('Farine de blé', 'kg', 700, 'epicerie', 'Sac (25 kg)', 25),
  ('Spaghetti', 'kg', 1100, 'epicerie', 'Carton (10 kg)', 10),
  ('Cubes et épices', 'piece', 30, 'epicerie', 'Boîte (100)', 100),
  ('Café moulu', 'kg', 4500, 'epicerie', 'Paquet (1 kg)', 1),
  ('Lait concentré', 'l', 1200, 'epicerie', 'Carton (12 l)', 12),
  ('Œufs', 'piece', 100, 'epicerie', 'Plateau (30)', 30),
  ('Pain', 'piece', 150, 'epicerie', 'Panier (20)', 20),
  ('Viande de bœuf', 'kg', 4200, 'boucherie', 'Lot (5 kg)', 5),
  ('Viande de chèvre', 'kg', 4800, 'boucherie', 'Lot (5 kg)', 5),
  ('Poulet entier', 'piece', 4500, 'boucherie', 'Lot (5 poulets)', 5),
  ('Poisson bar frais', 'kg', 3800, 'poissonnerie', 'Caisse (10 kg)', 10),
  ('Crevettes', 'kg', 6500, 'poissonnerie', 'Lot (2 kg)', 2),
  ('Poisson fumé', 'kg', 4000, 'poissonnerie', 'Lot (2 kg)', 2)
) AS v(name, unit, cost, sup, pack_label, pack_size);

INSERT INTO ingredients (id, structure_id, name, unit, cost_per_unit, is_active, created_at, updated_at)
SELECT i.id, pg_temp.sid(), i.name, i.unit, i.cost, true, pg_temp.at((SELECT t_start FROM demo_ctx) - 7, 660), pg_temp.at((SELECT t_start FROM demo_ctx) - 7, 660)
FROM demo_ing i;

-- Fiches recettes : élément (produit ou accompagnement), ingrédient, quantité, unité, perte %
CREATE TEMP TABLE demo_recipe ON COMMIT DROP AS
SELECT * FROM (VALUES
  ('Ndolé aux crevettes', 'Feuilles de ndolé lavées', 180, 'g', 10), ('Ndolé aux crevettes', 'Arachides crues', 80, 'g', 0),
  ('Ndolé aux crevettes', 'Crevettes', 60, 'g', 5), ('Ndolé aux crevettes', 'Poisson fumé', 30, 'g', 0),
  ('Ndolé aux crevettes', 'Oignons', 30, 'g', 5), ('Ndolé aux crevettes', 'Huile végétale', 30, 'ml', 0),
  ('Ndolé aux crevettes', 'Ail et gingembre', 10, 'g', 0), ('Ndolé aux crevettes', 'Cubes et épices', 1, 'piece', 0),
  ('Poulet DG', 'Poulet entier', 0.25, 'piece', 0), ('Poulet DG', 'Plantain mûr', 2, 'piece', 0),
  ('Poulet DG', 'Tomates', 80, 'g', 5), ('Poulet DG', 'Oignons', 50, 'g', 5), ('Poulet DG', 'Huile végétale', 60, 'ml', 0),
  ('Poulet DG', 'Piment', 5, 'g', 0), ('Poulet DG', 'Ail et gingembre', 10, 'g', 0), ('Poulet DG', 'Cubes et épices', 1, 'piece', 0),
  ('Eru et water fufu', 'Eru émincé', 150, 'g', 5), ('Eru et water fufu', 'Waterleaf', 120, 'g', 10),
  ('Eru et water fufu', 'Huile de palme', 60, 'ml', 0), ('Eru et water fufu', 'Viande de bœuf', 60, 'g', 5),
  ('Eru et water fufu', 'Poisson fumé', 30, 'g', 0), ('Eru et water fufu', 'Cubes et épices', 1, 'piece', 0),
  ('Eru et water fufu', 'Water fufu (boule)', 2, 'piece', 0),
  ('Okok sucré', 'Feuilles d''okok', 150, 'g', 5), ('Okok sucré', 'Arachides crues', 70, 'g', 0),
  ('Okok sucré', 'Huile de palme', 40, 'ml', 0), ('Okok sucré', 'Sucre', 20, 'g', 0),
  ('Kondrè de chèvre', 'Viande de chèvre', 250, 'g', 8), ('Kondrè de chèvre', 'Plantain vert', 2, 'piece', 0),
  ('Kondrè de chèvre', 'Tomates', 50, 'g', 5), ('Kondrè de chèvre', 'Oignons', 30, 'g', 5),
  ('Kondrè de chèvre', 'Huile de palme', 40, 'ml', 0), ('Kondrè de chèvre', 'Ail et gingembre', 10, 'g', 0),
  ('Kondrè de chèvre', 'Cubes et épices', 1, 'piece', 0),
  ('Taro sauce jaune', 'Taro', 400, 'g', 10), ('Taro sauce jaune', 'Huile de palme', 50, 'ml', 0),
  ('Taro sauce jaune', 'Viande de bœuf', 80, 'g', 5), ('Taro sauce jaune', 'Piment', 5, 'g', 0), ('Taro sauce jaune', 'Cubes et épices', 1, 'piece', 0),
  ('Sauce gombo et couscous maïs', 'Gombo', 150, 'g', 5), ('Sauce gombo et couscous maïs', 'Farine de maïs', 200, 'g', 0),
  ('Sauce gombo et couscous maïs', 'Viande de bœuf', 60, 'g', 5), ('Sauce gombo et couscous maïs', 'Huile de palme', 30, 'ml', 0),
  ('Sauce gombo et couscous maïs', 'Cubes et épices', 1, 'piece', 0),
  ('Spaghetti sautés', 'Spaghetti', 150, 'g', 0), ('Spaghetti sautés', 'Tomates', 60, 'g', 5), ('Spaghetti sautés', 'Oignons', 30, 'g', 5),
  ('Spaghetti sautés', 'Huile végétale', 30, 'ml', 0), ('Spaghetti sautés', 'Œufs', 1, 'piece', 0), ('Spaghetti sautés', 'Cubes et épices', 1, 'piece', 0),
  ('Poisson braisé', 'Poisson bar frais', 600, 'g', 15), ('Poisson braisé', 'Piment', 10, 'g', 0),
  ('Poisson braisé', 'Ail et gingembre', 15, 'g', 0), ('Poisson braisé', 'Oignons', 30, 'g', 5),
  ('Poisson braisé', 'Huile végétale', 20, 'ml', 0), ('Poisson braisé', 'Charbon de bois', 400, 'g', 0), ('Poisson braisé', 'Citrons', 1, 'piece', 0),
  ('Poulet braisé (½)', 'Poulet entier', 0.5, 'piece', 0), ('Poulet braisé (½)', 'Charbon de bois', 300, 'g', 0),
  ('Poulet braisé (½)', 'Ail et gingembre', 10, 'g', 0), ('Poulet braisé (½)', 'Piment', 5, 'g', 0), ('Poulet braisé (½)', 'Oignons', 30, 'g', 5),
  ('Brochettes de bœuf (×4)', 'Viande de bœuf', 200, 'g', 5), ('Brochettes de bœuf (×4)', 'Oignons', 40, 'g', 5),
  ('Brochettes de bœuf (×4)', 'Piment', 5, 'g', 0), ('Brochettes de bœuf (×4)', 'Charbon de bois', 200, 'g', 0),
  ('Brochettes de bœuf (×4)', 'Cubes et épices', 1, 'piece', 0),
  ('Soya de bœuf', 'Viande de bœuf', 150, 'g', 5), ('Soya de bœuf', 'Oignons', 30, 'g', 5),
  ('Soya de bœuf', 'Piment', 5, 'g', 0), ('Soya de bœuf', 'Charbon de bois', 150, 'g', 0),
  ('Omelette et pain', 'Œufs', 3, 'piece', 0), ('Omelette et pain', 'Oignons', 20, 'g', 5), ('Omelette et pain', 'Tomates', 30, 'g', 5),
  ('Omelette et pain', 'Huile végétale', 20, 'ml', 0), ('Omelette et pain', 'Pain', 1, 'piece', 0),
  ('Beignets haricots bouillie', 'Farine de blé', 150, 'g', 0), ('Beignets haricots bouillie', 'Haricots rouges', 100, 'g', 0),
  ('Beignets haricots bouillie', 'Huile végétale', 80, 'ml', 0), ('Beignets haricots bouillie', 'Sucre', 30, 'g', 0),
  ('Salade de fruits', 'Fruits de saison', 300, 'g', 15), ('Salade de fruits', 'Sucre', 10, 'g', 0), ('Salade de fruits', 'Citrons', 0.5, 'piece', 0),
  ('Jus de foléré maison', 'Folérés secs', 30, 'g', 0), ('Jus de foléré maison', 'Sucre', 60, 'g', 0), ('Jus de foléré maison', 'Citrons', 0.5, 'piece', 0),
  ('Cocktail La Vallée (sans alcool)', 'Fruits de saison', 250, 'g', 10), ('Cocktail La Vallée (sans alcool)', 'Sucre', 20, 'g', 0),
  ('Cocktail La Vallée (sans alcool)', 'Citrons', 1, 'piece', 0),
  ('Café', 'Café moulu', 12, 'g', 0), ('Café', 'Sucre', 10, 'g', 0), ('Café', 'Lait concentré', 20, 'ml', 0),
  ('Citronnelle', 'Sucre', 10, 'g', 0), ('Citronnelle', 'Citrons', 0.5, 'piece', 0),
  ('Plantain mûr frit', 'Plantain mûr', 2, 'piece', 0), ('Plantain mûr frit', 'Huile végétale', 30, 'ml', 0),
  ('Frites de pommes', 'Pommes de terre', 300, 'g', 10), ('Frites de pommes', 'Huile végétale', 50, 'ml', 0),
  ('Riz blanc', 'Riz parfumé', 150, 'g', 0),
  ('Miondo (3 bâtons)', 'Miondo', 3, 'piece', 0),
  ('Bâton de manioc', 'Bâtons de manioc', 1, 'piece', 0)
) AS v(item, ingredient, quantity, unit, waste);

INSERT INTO recipe_items (structure_id, product_id, accompaniment_id, ingredient_id, quantity, unit, waste_percent, created_at)
SELECT pg_temp.sid(), p.id, a.id, i.id, r.quantity, r.unit, r.waste, pg_temp.at((SELECT t_start FROM demo_ctx) - 7, 670)
FROM demo_recipe r
LEFT JOIN demo_prod p ON p.name = r.item
LEFT JOIN demo_acc a ON a.name = r.item
JOIN demo_ing i ON i.name = r.ingredient;

DO $$
BEGIN
  IF (SELECT count(*) FROM recipe_items WHERE structure_id = pg_temp.sid()) <> (SELECT count(*) FROM demo_recipe) THEN
    RAISE EXCEPTION 'Fiche recette incomplète (nom d''élément ou d''ingrédient inconnu)';
  END IF;
END $$;

-- Quantité brute en unité de stock (comme grossQuantity de lib/recipes.ts)
CREATE FUNCTION pg_temp.gross(q numeric, unit text, waste numeric) RETURNS numeric LANGUAGE sql IMMUTABLE AS
$$ SELECT (CASE WHEN unit IN ('g', 'ml') THEN q / 1000 ELSE q END) / (1 - LEAST(GREATEST(waste, 0), 89.99) / 100) $$;

-- Ventes moyennes attendues par jour (unités), pour le stock initial et les réapprovisionnements
UPDATE demo_prod p SET exp_daily = x.per_day * p.weight / x.pool_weight
FROM (SELECT pool, sum(weight) AS pool_weight,
             CASE pool WHEN 'plat' THEN 46 WHEN 'matin' THEN 5 WHEN 'dessert' THEN 3 WHEN 'biere' THEN 50
                       WHEN 'boisson' THEN 30 WHEN 'vin' THEN 3 WHEN 'chaud' THEN 6 END AS per_day
      FROM demo_prod GROUP BY pool) x
WHERE x.pool = p.pool;
UPDATE demo_acc a SET exp_daily = (SELECT sum(exp_daily) FROM demo_prod WHERE accomp) * a.weight / (SELECT sum(weight) FROM demo_acc);
UPDATE demo_ing i SET exp_daily = COALESCE((
  SELECT sum(pg_temp.gross(ri.quantity, ri.unit, ri.waste_percent) * COALESCE(p.exp_daily, a.exp_daily))
  FROM recipe_items ri LEFT JOIN demo_prod p ON p.id = ri.product_id LEFT JOIN demo_acc a ON a.id = ri.accompaniment_id
  WHERE ri.ingredient_id = i.id), 0);

-- ── Fournisseurs ─────────────────────────────────────────────────────────────

CREATE TEMP TABLE demo_sup ON COMMIT DROP AS
SELECT v.*, gen_random_uuid() AS id
FROM (VALUES
  ('marche', 'Marché A de Dschang — Mama Rosalie', 'Rosalie Ngo Bisseck', '+237 677 41 22 18', NULL, false, ARRAY[1, 4]::smallint[], 0, 'CASH', 0),
  ('epicerie', 'Épicerie Centrale de Dschang', 'Mme Kamdem', '+237 699 12 45 63', 'P011712345678K', false, ARRAY[1]::smallint[], 0, 'CASH', 0),
  ('boucherie', 'Boucherie Tagne & Fils', 'Jean-Marie Tagne', '+237 675 88 03 41', NULL, false, ARRAY[2, 5]::smallint[], 0, 'CASH', 0),
  ('poissonnerie', 'Poissonnerie du Noun', 'Ibrahim Njoya', '+237 690 27 74 15', NULL, false, ARRAY[2, 5]::smallint[], 1, 'MOBILE', 0),
  ('sabc', 'SABC — Dépôt de Dschang', 'Service commercial', '+237 233 45 12 00', 'M041200001234A', true, ARRAY[3]::smallint[], 2, 'TRANSFER', 7),
  ('fotso', 'Dépôt Fotso & Fils (Guinness, eaux, vins)', 'Emmanuel Fotso', '+237 677 90 31 22', 'M091500004567B', true, ARRAY[3]::smallint[], 2, 'TRANSFER', 10),
  ('eneo', 'ENEO Cameroun', NULL, '8010', 'M039900000111C', true, ARRAY[]::smallint[], 0, 'MOBILE', 8),
  ('camwater', 'CAMWATER', NULL, '8090', 'M049900000222D', true, ARRAY[]::smallint[], 0, 'MOBILE', 8),
  ('mtn', 'MTN Cameroon — Internet Box', NULL, '8787', 'M029900000333E', true, ARRAY[]::smallint[], 0, 'MOBILE', 0),
  ('bailleur', 'M. Pierre Kamga (bailleur)', 'Pierre Kamga', '+237 677 55 10 09', NULL, false, ARRAY[]::smallint[], 0, 'TRANSFER', 0),
  ('tradex', 'Tradex Gaz Dschang', NULL, '+237 699 33 21 10', 'M019900000444F', true, ARRAY[]::smallint[], 0, 'CASH', 0),
  ('kenmogne', 'Ets Kenmogne Électricité & Froid', 'Alain Kenmogne', '+237 670 14 52 87', NULL, false, ARRAY[]::smallint[], 0, 'CASH', 0),
  ('banque', 'Afriland First Bank', NULL, '+237 233 42 11 54', 'M039900000555G', true, ARRAY[]::smallint[], 0, 'TRANSFER', 0),
  ('media', 'Ouest Médias & Réseaux', 'Linda Fokou', '+237 655 41 87 20', NULL, false, ARRAY[]::smallint[], 0, 'MOBILE', 0)
) AS v(k, name, contact_name, phone, niu, vat, days, lead, pay, pay_delay);

INSERT INTO suppliers (id, structure_id, name, contact_name, phone, niu, address, is_active, delivery_days, lead_time_days, min_order_amount, charges_vat, created_at)
SELECT s.id, pg_temp.sid(), s.name, s.contact_name, s.phone, s.niu, 'Dschang', true, s.days, s.lead,
       CASE WHEN s.k IN ('sabc', 'fotso') THEN 50000 ELSE 0 END, s.vat, pg_temp.at((SELECT t_start FROM demo_ctx) - 7, 680)
FROM demo_sup s;
CREATE FUNCTION pg_temp.sup(key text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM demo_sup WHERE k = key $$;

INSERT INTO supplier_items (structure_id, supplier_id, ingredient_id, pack_label, pack_size, unit_price, is_preferred, is_active)
SELECT pg_temp.sid(), pg_temp.sup(i.sup), i.id, i.pack_label, i.pack_size, round(i.cost * i.pack_size), true, true FROM demo_ing i;
INSERT INTO supplier_items (structure_id, supplier_id, product_id, pack_label, pack_size, unit_price, is_preferred, is_active)
SELECT pg_temp.sid(), pg_temp.sup(p.sup), p.id, p.pack_label, p.pack_size, round(p.cost * p.pack_size), true, true FROM demo_prod p WHERE p.sup IS NOT NULL;

-- ── Livraison, banque, clients, promotions, événements ───────────────────────

CREATE TEMP TABLE demo_zone ON COMMIT DROP AS
SELECT v.*, gen_random_uuid() AS id
FROM (VALUES ('Centre-ville', 500, ARRAY['Marché A', 'Carrefour Ngui', 'Quartier administratif', 'Tsinkop']),
             ('Foto — campus universitaire', 1000, ARRAY['Cité U', 'Entrée campus A', 'Carrefour Foto']),
             ('Foréké-Dschang', 1500, ARRAY['Chefferie Foréké', 'Lycée de Foréké']),
             ('Fongo-Ndeng', 2000, ARRAY['Carrefour Fongo', 'Mission catholique'])) AS v(name, fee, districts);
INSERT INTO delivery_zones (id, structure_id, name, fee, is_active, created_at)
SELECT id, pg_temp.sid(), name, fee, true, pg_temp.at((SELECT t_start FROM demo_ctx) - 7, 690) FROM demo_zone;

CREATE TEMP TABLE demo_bank ON COMMIT DROP AS
SELECT gen_random_uuid() AS main_id, gen_random_uuid() AS momo_id;
INSERT INTO bank_accounts (id, structure_id, name, bank_name, account_number, account, opening_balance, opening_date, is_active, created_at)
SELECT b.main_id, c.sid, 'Compte courant Afriland', 'Afriland First Bank — agence de Dschang', '10005 00021 06412358001 54', '521', 4800000, c.t_start, true, pg_temp.at(c.t_start, 480)
FROM demo_bank b, demo_ctx c;
INSERT INTO bank_accounts (id, structure_id, name, bank_name, account_number, account, opening_balance, opening_date, is_active, created_at)
SELECT b.momo_id, c.sid, 'MTN Mobile Money marchand', 'MTN Mobile Money', '237 656 954 474', '552', 120000, c.t_start, true, pg_temp.at(c.t_start, 480)
FROM demo_bank b, demo_ctx c;

INSERT INTO clients (structure_id, first_name, last_name, phone, email, birthday, allergies, preferences, notes, created_at)
SELECT pg_temp.sid(), v.fn, v.ln, v.phone, v.email, v.birthday::date, v.allergies, v.prefs, v.notes, pg_temp.at((SELECT t_start FROM demo_ctx) + v.day, 720)
FROM (VALUES
  ('Martin', 'Fokou', '+237 677 12 34 56', 'martin.fokou@gmail.com', '1979-03-14', NULL, 'Table en terrasse, poisson bien braisé', 'Vient tous les vendredis soir', 2),
  ('Josiane', 'Tchoupo', '+237 699 45 21 87', NULL, '1985-11-02', 'Arachides', 'Poulet DG sans piment', NULL, 3),
  ('Dr Emmanuel', 'Tchoumi', '+237 675 20 11 43', 'e.tchoumi@univ-dschang.org', '1971-07-22', NULL, 'Réserve pour des collègues', 'Contact pour les séminaires de la FASA', 5),
  ('Bertrand', 'Nguimfack', '+237 690 33 87 12', NULL, '1990-01-30', NULL, 'Bières bien fraîches, match du week-end', NULL, 6),
  ('Sylvie', 'Mbah', '+237 677 98 45 01', 'sylvie.mbah@yahoo.fr', '1988-06-18', 'Crevettes', 'Plats sans crevettes', 'Allergie confirmée : prévenir la cuisine', 8),
  ('Olivier', 'Kamgang', '+237 655 76 22 90', NULL, '1983-09-09', NULL, 'Chambre CH3, petit-déjeuner à 7 h', 'Client fidèle de l''hôtel', 9),
  ('Clarisse', 'Djiofack', '+237 698 14 67 33', NULL, '1995-12-25', NULL, 'Cocktail La Vallée', NULL, 11),
  ('Pasteur Daniel', 'Wambo', '+237 677 61 09 54', NULL, '1966-04-04', NULL, 'Déjeuner le dimanche après le culte, table de 8', NULL, 12),
  ('Rachel', 'Ngoufack', '+237 676 82 30 17', 'rachel.ngoufack@gmail.com', '1992-02-11', 'Gluten', 'Pas de beignets', NULL, 14),
  ('Ernest', 'Tagne', '+237 699 03 58 26', NULL, '1975-08-30', NULL, 'Kondrè de chèvre', 'Frère du boucher', 15),
  ('Mireille', 'Fotsing', '+237 677 27 49 81', NULL, '1987-05-05', NULL, 'Livraison au bureau, quartier administratif', NULL, 17),
  ('Hugues', 'Kenne', '+237 690 58 12 64', NULL, '1980-10-19', NULL, 'Whisky Jameson, table au calme', NULL, 19),
  ('Brigitte', 'Nzeuton', '+237 675 44 90 38', 'b.nzeuton@agri-ouest.org', '1984-03-27', NULL, 'Factures au nom de l''ONG Agri-Ouest', NULL, 21),
  ('Alain', 'Mefire', '+237 698 71 25 49', NULL, '1993-07-07', NULL, 'Soya et 33 Export', NULL, 23),
  ('Nadège', 'Kouam', '+237 677 36 18 92', NULL, '1991-09-15', 'Piment', 'Sans piment', NULL, 26),
  ('Serge', 'Talla', '+237 690 92 47 06', NULL, '1978-12-01', NULL, 'Poisson braisé, plantain mûr', 'Commande souvent pour 10 personnes', 28),
  ('Estelle', 'Momo', '+237 655 19 83 27', NULL, '1996-04-21', NULL, 'Salade de fruits', NULL, 31),
  ('Félix', 'Ndongmo', '+237 699 66 31 75', NULL, '1969-01-09', NULL, 'Eru et water fufu', NULL, 34),
  ('Laure', 'Tchakounté', '+237 677 50 72 14', 'laure.t@gmail.com', '1989-08-12', NULL, 'Anniversaires : gâteau commandé à l''avance', NULL, 37),
  ('Patrick', 'Simo', '+237 676 23 84 59', NULL, '1982-11-28', NULL, 'Chambre familiale CH5 pour les vacances', NULL, 40),
  ('Yvonne', 'Fotié', '+237 690 47 95 23', NULL, '1974-02-17', 'Lactose', 'Café sans lait', NULL, 43),
  ('Christian', 'Nkamga', '+237 698 38 26 70', NULL, '1997-06-03', NULL, 'Livraison campus, cité U', NULL, 47),
  ('Gisèle', 'Lontsi', '+237 677 85 14 36', NULL, '1986-10-10', NULL, 'Okok sucré', NULL, 52),
  ('Thierry', 'Kamdem', '+237 655 90 61 48', NULL, '1977-05-29', NULL, 'Table 4, groupe d''amis le samedi', NULL, 55),
  ('Viviane', 'Ngassa', '+237 699 21 70 85', NULL, '1994-03-08', NULL, 'Jus de foléré', NULL, 60),
  ('Roger', 'Tchinda', '+237 676 64 39 12', NULL, '1968-09-24', NULL, 'Taro sauce jaune', 'Ancien chef de la chefferie', 64),
  ('Pauline', 'Nana', '+237 690 15 88 47', NULL, '1990-12-14', NULL, 'Réservation de la terrasse pour 20 personnes', NULL, 69),
  ('Gilles', 'Djoko', '+237 677 72 05 63', NULL, '1981-04-30', NULL, 'Brochettes de bœuf', NULL, 74),
  ('Carole', 'Fonkou', '+237 698 49 13 80', NULL, '1999-07-19', NULL, 'Spaghetti sautés', NULL, 80),
  ('Michel', 'Ateba', '+237 655 36 92 21', NULL, '1972-01-26', NULL, 'Mützig, poulet braisé', NULL, 86)
) AS v(fn, ln, phone, email, birthday, allergies, prefs, notes, day);

CREATE TEMP TABLE demo_promo ON COMMIT DROP AS
SELECT gen_random_uuid() AS beer_id, gen_random_uuid() AS rentree_id, gen_random_uuid() AS code_id;
INSERT INTO promotions (id, structure_id, name, type, value, scope, product_id, min_order_amount, start_date, end_date, is_active, promo_mode, required_qty, free_qty, is_cumulative, created_at)
SELECT p.beer_id, c.sid, 'Happy hour 33 Export : 3 achetées, 1 offerte', 'PERCENTAGE', 0, 'PRODUCT',
       (SELECT id FROM demo_prod WHERE name = '33 Export (65 cl)'), 0, pg_temp.at(c.t_start + 30, 0), pg_temp.at(c.t_start + 44, 1439), true, 'BUY_X_GET_Y', 3, 1, true, pg_temp.at(c.t_start + 28, 600)
FROM demo_promo p, demo_ctx c;
INSERT INTO promotions (id, structure_id, name, type, value, scope, min_order_amount, start_date, end_date, is_active, promo_mode, created_at)
SELECT p.rentree_id, c.sid, 'Rentrée : -10 % dès 15 000 FCFA', 'PERCENTAGE', 10, 'ORDER', 15000,
       pg_temp.at(c.t_start + 45, 0), pg_temp.at(c.t_start + 58, 1439), true, 'STANDARD', pg_temp.at(c.t_start + 43, 600)
FROM demo_promo p, demo_ctx c;
INSERT INTO promotions (id, structure_id, name, type, value, scope, min_order_amount, start_date, end_date, is_active, promo_mode, code_name, usage_limit, created_at)
SELECT p.code_id, c.sid, 'Code fidélité BANA10 : -10 %', 'PERCENTAGE', 10, 'ORDER', 0,
       pg_temp.at(c.t_end - 30, 0), pg_temp.at(c.t_end + 30, 1439), true, 'CODE', 'BANA10', 500, pg_temp.at(c.t_end - 31, 600)
FROM demo_promo p, demo_ctx c;

INSERT INTO forecast_events (structure_id, event_date, label, impact_percent, created_by, created_at)
SELECT c.sid, v.d, v.label, v.impact, pg_temp.uid('gerant'), pg_temp.at(c.t_start + 1, 600)
FROM demo_ctx c,
LATERAL (VALUES
  (make_date(extract(year FROM c.t_start)::int, 8, 15), 'Assomption (jour férié)', 40),
  (c.t_start + 52, 'Match des Lions indomptables', 30),
  (c.t_start + 75, 'Rentrée universitaire', 20),
  (c.t_end + 3, 'Marché périodique de Dschang', 15),
  (c.t_end + 9, 'Soirée privatisée — Afriland', 60)
) AS v(d, label, impact)
WHERE v.d BETWEEN c.t_start AND c.t_end + 30;

-- Clients facturés (B2B)
CREATE TEMP TABLE demo_cust ON COMMIT DROP AS
SELECT v.*, gen_random_uuid() AS id
FROM (VALUES
  ('univ', 'Université de Dschang — FASA', 'Dr Emmanuel Tchoumi', '+237 675 20 11 43', 'e.tchoumi@univ-dschang.org', 'M011100008888A', 'Campus de Foto', 30),
  ('commune', 'Commune de Dschang', 'Service des affaires générales', '+237 233 45 10 22', 'mairie@dschang.cm', 'M021100007777B', 'Hôtel de ville', 45),
  ('ong', 'ONG Agri-Ouest', 'Brigitte Nzeuton', '+237 675 44 90 38', 'b.nzeuton@agri-ouest.org', 'P041200006666C', 'Quartier Tsinkop', 30),
  ('cabinet', 'Cabinet Ngandjeu & Associés', 'Me Ngandjeu', '+237 699 58 31 40', 'contact@ngandjeu-avocats.cm', 'P051300005555D', 'Carrefour Ngui', 15),
  ('afriland', 'Afriland First Bank — agence de Dschang', 'Direction de l''agence', '+237 233 42 11 54', 'dschang@afrilandfirstbank.com', 'M039900000555G', 'Avenue principale', 30)
) AS v(k, name, contact_name, phone, email, niu, address, terms);
INSERT INTO customers (id, structure_id, name, contact_name, phone, email, niu, address, city, payment_terms_days, is_active, created_at)
SELECT k.id, pg_temp.sid(), k.name, k.contact_name, k.phone, k.email, k.niu, k.address, 'Dschang', k.terms, true, pg_temp.at((SELECT t_start FROM demo_ctx) + 2, 600)
FROM demo_cust k;

-- ── Immobilisations ──────────────────────────────────────────────────────────

CREATE TEMP TABLE demo_asset ON COMMIT DROP AS
SELECT v.*, gen_random_uuid() AS id
FROM (VALUES
  ('Mobilier de terrasse (20 tables, 80 chaises)', 'office', '244', '2844', -250, 1850000, 60, 'Menuiserie Fotié', true),
  ('Groupe électrogène 20 kVA', 'equipment', '241', '2841', -160, 3400000, 60, 'Ets Kenmogne', true),
  ('Congélateur coffre 500 L', 'equipment', '241', '2841', -110, 780000, 60, 'Ets Kenmogne', true),
  ('Moto de livraison Haojue 125', 'vehicles', '245', '2845', 12, 950000, 48, 'Moto Center Dschang', false)
) AS v(name, category, asset_account, dep_account, day_offset, cost, months, vendor, before_start);
INSERT INTO fixed_assets (id, structure_id, name, category, asset_account, depreciation_account, expense_account, acquisition_date, in_service_date, cost, useful_life_months, reference, notes, status, created_by, created_at)
SELECT a.id, c.sid, a.name, a.category, a.asset_account, a.dep_account, '681', c.t_start + a.day_offset, c.t_start + a.day_offset, a.cost, a.months,
       'FAC-' || upper(left(replace(a.vendor, ' ', ''), 6)) || '-' || to_char(c.t_start + a.day_offset, 'YYMMDD'), 'Fournisseur : ' || a.vendor, 'ACTIVE',
       pg_temp.uid('compta'), pg_temp.at(GREATEST(c.t_start, c.t_start + a.day_offset), 900)
FROM demo_asset a, demo_ctx c;

-- Amortissement cumulé (comme cumulativeDepreciation de lib/fixed-assets.ts)
CREATE FUNCTION pg_temp.cumdep(cost numeric, months int, in_service date, as_of date) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN months <= 0 OR as_of < in_service THEN 0
    WHEN as_of >= (in_service + make_interval(months => months))::date THEN round(cost)
    ELSE LEAST(round(cost), round((cost * 12 / months) * ((as_of - in_service) + 1) / 365))
  END
$$;

-- ── Tables de travail de la simulation ───────────────────────────────────────

CREATE TEMP TABLE demo_events (ts timestamptz NOT NULL, prio int NOT NULL DEFAULT 5, kind text NOT NULL, ref uuid, data jsonb) ON COMMIT DROP;
CREATE TEMP TABLE demo_cart (product_id uuid, qty int) ON COMMIT DROP;

-- Stock : mouvement + mise à jour de la ligne de stock (comme recordStockMovement)
CREATE FUNCTION pg_temp.move(p_kind text, p_item uuid, p_type text, p_qty numeric, p_reason text, p_ref text, p_user uuid, p_ts timestamptz,
                             p_cost numeric DEFAULT NULL, p_loss text DEFAULT NULL, p_note text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  INSERT INTO stock_movements (structure_id, product_id, accompaniment_id, ingredient_id, user_id, type, quantity, reason, reference_id, created_at, unit_cost, loss_reason, note)
  VALUES (pg_temp.sid(), CASE WHEN p_kind = 'product' THEN p_item END, CASE WHEN p_kind = 'accompaniment' THEN p_item END,
          CASE WHEN p_kind = 'ingredient' THEN p_item END, p_user, p_type, round(p_qty, 4), p_reason, p_ref, p_ts, p_cost, p_loss, p_note);
  IF p_kind = 'ingredient' THEN
    UPDATE stocks SET quantity = CASE WHEN p_type = 'IN' THEN quantity + p_qty WHEN p_type = 'OUT' THEN quantity - p_qty ELSE p_qty END, updated_at = p_ts
    WHERE structure_id = pg_temp.sid() AND ingredient_id = p_item;
  ELSE
    UPDATE stocks SET quantity = CASE WHEN p_type = 'IN' THEN quantity + p_qty WHEN p_type = 'OUT' THEN quantity - p_qty ELSE p_qty END, updated_at = p_ts
    WHERE structure_id = pg_temp.sid() AND product_id = p_item;
  END IF;
END $f$;

-- Sorties de stock d'une commande payée (comme deductOrderStock de lib/stock.ts)
CREATE FUNCTION pg_temp.deduct(p_order uuid, p_ts timestamptz, p_user uuid) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT ri.ingredient_id AS item, 'ingredient' AS kind, sum(pg_temp.gross(ri.quantity, ri.unit, ri.waste_percent) * oi.quantity) AS qty, max(i.cost_per_unit) AS cost
    FROM order_items oi JOIN recipe_items ri ON ri.product_id = oi.product_id JOIN ingredients i ON i.id = ri.ingredient_id
    WHERE oi.order_id = p_order GROUP BY ri.ingredient_id
    UNION ALL
    SELECT ri.ingredient_id, 'ingredient', sum(pg_temp.gross(ri.quantity, ri.unit, ri.waste_percent) * oa.quantity), max(i.cost_per_unit)
    FROM order_accompaniments oa JOIN recipe_items ri ON ri.accompaniment_id = oa.accompaniment_id JOIN ingredients i ON i.id = ri.ingredient_id
    WHERE oa.order_id = p_order GROUP BY ri.ingredient_id
    UNION ALL
    SELECT oi.product_id, 'product', sum(oi.quantity), max(p.purchase_cost)
    FROM order_items oi JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order AND NOT EXISTS (SELECT 1 FROM recipe_items ri WHERE ri.product_id = oi.product_id)
    GROUP BY oi.product_id
  LOOP
    PERFORM pg_temp.move(r.kind, r.item, 'OUT', round(r.qty, 4), 'sale', p_order::text, p_user, p_ts, r.cost);
  END LOOP;
END $f$;

-- Une commande complète : articles, accompagnements, montants (lib/order-totals.ts), paiement, stock
CREATE FUNCTION pg_temp.new_order(p_ts timestamptz, p_slot text, p_kind text) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE
  c demo_ctx%ROWTYPE;
  v_id uuid := gen_random_uuid();
  v_user uuid;
  n_dish int; n_drink int; i int;
  v_prod uuid;
  r record;
  v_sub numeric := 0; v_run numeric := 0; v_manual numeric := 0; v_tip numeric := 0;
  v_fee numeric := 0; v_takeaway numeric := 0; v_base numeric; v_tax numeric; v_total numeric; v_disc numeric;
  v_promo uuid; v_cancel boolean; v_paid timestamptz; v_method text;
  v_zone_id uuid; v_zone_name text; v_zone_districts text[]; v_table_id uuid; v_has_kitchen boolean; v_has_bar boolean;
  v_item uuid; v_acc record; v_free int;
  v_partner text;
BEGIN
  SELECT * INTO c FROM demo_ctx;
  TRUNCATE demo_cart;

  -- Composition du panier selon le moment et le type de commande
  IF p_slot = 'matin' THEN
    INSERT INTO demo_cart SELECT id, pg_temp.rint(1, 2) FROM (SELECT id FROM demo_prod WHERE pool = 'matin' ORDER BY -ln(1 - random()) / weight LIMIT 1) x;
    IF pg_temp.chance(0.75) THEN INSERT INTO demo_cart SELECT id, pg_temp.rint(1, 2) FROM (SELECT id FROM demo_prod WHERE pool = 'chaud' ORDER BY -ln(1 - random()) / weight LIMIT 1) x; END IF;
    IF pg_temp.chance(0.2) THEN INSERT INTO demo_cart SELECT id, 1 FROM demo_prod WHERE name = 'Jus de foléré maison'; END IF;
  ELSE
    IF p_kind IN ('DELIVERY', 'API', 'TAKEAWAY') THEN
      n_dish := 1 + (pg_temp.chance(0.45))::int + (pg_temp.chance(0.15))::int;
      n_drink := (pg_temp.chance(0.55))::int + (pg_temp.chance(0.2))::int;
    ELSIF p_slot = 'midi' THEN
      n_dish := 1 + (pg_temp.chance(0.5))::int + (pg_temp.chance(0.2))::int + (pg_temp.chance(0.08))::int;
      n_drink := 1 + (pg_temp.chance(0.5))::int + (pg_temp.chance(0.2))::int;
    ELSE
      n_dish := (pg_temp.chance(0.85))::int + (pg_temp.chance(0.4))::int + (pg_temp.chance(0.15))::int;
      n_drink := 1 + (pg_temp.chance(0.7))::int + (pg_temp.chance(0.5))::int + (pg_temp.chance(0.35))::int + (pg_temp.chance(0.2))::int;
    END IF;
    FOR i IN 1..n_dish LOOP
      INSERT INTO demo_cart SELECT id, CASE WHEN pg_temp.chance(0.12) THEN 2 ELSE 1 END
      FROM (SELECT id FROM demo_prod WHERE pool = 'plat' ORDER BY -ln(1 - random()) / weight LIMIT 1) x;
    END LOOP;
    IF n_dish > 0 AND pg_temp.chance(0.1) THEN INSERT INTO demo_cart SELECT id, 1 FROM demo_prod WHERE pool = 'dessert'; END IF;
    FOR i IN 1..n_drink LOOP
      INSERT INTO demo_cart SELECT id, CASE WHEN pool = 'biere' AND pg_temp.chance(0.35) THEN pg_temp.rint(2, 4) ELSE 1 END
      FROM (SELECT id, pool FROM demo_prod
            WHERE CASE WHEN p_kind IN ('DELIVERY', 'API', 'TAKEAWAY') THEN pool = 'boisson' AND deliverable
                       WHEN p_slot = 'soir' THEN pool IN ('biere', 'boisson', 'vin')
                       ELSE pool IN ('biere', 'boisson') END
            ORDER BY -ln(1 - random()) / (weight * CASE WHEN p_slot = 'soir' AND pool = 'biere' THEN 2.2 WHEN p_slot = 'midi' AND pool = 'boisson' THEN 1.6 ELSE 1 END)
            LIMIT 1) x;
    END LOOP;
  END IF;

  -- Personnel : salle par un serveur, comptoir / livraison par la caisse
  v_user := CASE WHEN p_kind = 'DINE_IN' THEN pg_temp.uid(pg_temp.pick(ARRAY['serveur1', 'serveur2', 'serveur3']))
                 WHEN p_kind = 'API' THEN NULL
                 ELSE pg_temp.uid(CASE WHEN extract(isodow FROM pg_temp.ddate(p_ts)) >= 5 THEN 'caisse2' ELSE 'caisse1' END) END;
  v_cancel := p_kind <> 'API' AND pg_temp.chance(0.03);
  v_partner := CASE WHEN p_kind = 'API' THEN pg_temp.pick(ARRAY['Yango Food', 'Yango Food', 'Tchop Express']) END;

  IF p_kind = 'DINE_IN' THEN
    SELECT id INTO v_table_id FROM tables WHERE structure_id = c.sid ORDER BY random() LIMIT 1;
  END IF;
  IF p_kind = 'DELIVERY' THEN
    SELECT id, name, districts, fee INTO v_zone_id, v_zone_name, v_zone_districts, v_fee FROM demo_zone ORDER BY -ln(1 - random()) / CASE name WHEN 'Centre-ville' THEN 6 WHEN 'Foto — campus universitaire' THEN 4 ELSE 1.5 END LIMIT 1;
  END IF;
  IF p_kind = 'TAKEAWAY' THEN v_takeaway := c.takeaway_fee; END IF;

  INSERT INTO orders (id, structure_id, user_id, status, created_at, updated_at, source, consumption_type, table_id, covers, notes,
                      takeaway_fee, delivery_fee, delivery_zone_id, delivery_zone_name, delivery_city, delivery_district, delivery_landmark, phone, customer_name,
                      partner, external_id, acceptance, accepted_at, prep_minutes, tax_rate, prices_include_tax)
  VALUES (v_id, c.sid, v_user, 'PENDING', p_ts, p_ts, CASE WHEN p_kind = 'API' THEN 'API' ELSE 'CAISSE' END,
          CASE WHEN p_kind IN ('DELIVERY', 'API') THEN 'DELIVERY' WHEN p_kind = 'TAKEAWAY' THEN 'TAKEAWAY' ELSE 'DINE_IN' END,
          v_table_id, CASE WHEN p_kind = 'DINE_IN' THEN pg_temp.rint(1, 4) END,
          CASE WHEN pg_temp.chance(0.06) THEN pg_temp.pick(ARRAY['Sans piment', 'Bien cuit', 'Plantain bien mûr', 'Servir vite, client pressé', 'Sauce à part']) END,
          v_takeaway, v_fee, v_zone_id, v_zone_name, CASE WHEN p_kind IN ('DELIVERY', 'API') THEN 'Dschang' END,
          CASE WHEN p_kind = 'DELIVERY' THEN pg_temp.pick(v_zone_districts) WHEN p_kind = 'API' THEN pg_temp.pick(ARRAY['Centre-ville', 'Foto', 'Tsinkop']) END,
          CASE WHEN p_kind = 'DELIVERY' THEN pg_temp.pick(ARRAY['Face pharmacie du Centre', 'Derrière la station Total', 'Immeuble bleu, 2e étage', 'Portail noir après le carrefour', 'À côté de la boulangerie']) END,
          CASE WHEN p_kind IN ('DELIVERY', 'API', 'TAKEAWAY') THEN '+237 6' || lpad(pg_temp.rint(50000000, 99999999)::text, 8, '0') END,
          CASE WHEN p_kind IN ('DELIVERY', 'API') THEN pg_temp.pick(ARRAY['Arnaud T.', 'Mireille F.', 'Junior K.', 'Christelle N.', 'Boris M.', 'Sandra D.', 'Kevin W.', 'Ange S.']) END,
          v_partner, CASE WHEN p_kind = 'API' THEN upper(left(v_partner, 2)) || '-' || pg_temp.rint(100000, 999999) END,
          CASE WHEN p_kind = 'API' THEN 'ACCEPTED' END, CASE WHEN p_kind = 'API' THEN p_ts + interval '2 minutes' END,
          CASE WHEN p_kind = 'API' THEN 25 END, c.rate, true);

  -- Articles (un par produit, quantités regroupées) et accompagnements
  FOR r IN SELECT d.product_id, sum(d.qty)::int AS qty, p.price, p.accomp FROM demo_cart d JOIN demo_prod p ON p.id = d.product_id GROUP BY d.product_id, p.price, p.accomp LOOP
    v_item := gen_random_uuid();
    INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, total_price, created_at, is_price_counted, held, fired_at)
    VALUES (v_item, v_id, r.product_id, r.qty, r.price, r.price * r.qty, p_ts, true, false, p_ts);
    v_sub := v_sub + r.price * r.qty;
    IF r.accomp THEN
      SELECT * INTO v_acc FROM demo_acc ORDER BY -ln(1 - random()) / weight LIMIT 1;
      INSERT INTO order_accompaniments (order_id, parent_order_item_id, accompaniment_id, quantity, unit_price_snapshot, total_price_snapshot, is_price_counted, created_at, updated_at)
      VALUES (v_id, v_item, v_acc.id, r.qty, v_acc.price, v_acc.price * r.qty, true, p_ts AT TIME ZONE 'Africa/Douala', p_ts AT TIME ZONE 'Africa/Douala');
      v_sub := v_sub + v_acc.price * r.qty;
    END IF;
  END LOOP;

  -- Promotions automatiques actives, code promo, remise manuelle (computeOrderAmounts)
  v_run := v_sub;
  SELECT oi.quantity, oi.unit_price INTO r FROM order_items oi
  WHERE oi.order_id = v_id AND oi.product_id = (SELECT product_id FROM promotions WHERE id = (SELECT beer_id FROM demo_promo))
    AND p_ts BETWEEN (SELECT start_date FROM promotions WHERE id = (SELECT beer_id FROM demo_promo)) AND (SELECT end_date FROM promotions WHERE id = (SELECT beer_id FROM demo_promo));
  IF FOUND THEN
    v_free := floor(r.quantity / 4.0) * 1;
    v_run := v_run - v_free * r.unit_price;
  END IF;
  IF p_ts BETWEEN (SELECT start_date FROM promotions WHERE id = (SELECT rentree_id FROM demo_promo)) AND (SELECT end_date FROM promotions WHERE id = (SELECT rentree_id FROM demo_promo))
     AND v_run >= 15000 THEN
    v_run := v_run * 0.9;
  END IF;
  IF p_kind <> 'API' AND p_ts >= (SELECT start_date FROM promotions WHERE id = (SELECT code_id FROM demo_promo)) AND pg_temp.chance(0.06) THEN
    v_promo := (SELECT code_id FROM demo_promo);
    v_run := v_run * 0.9;
  END IF;
  IF p_kind = 'DINE_IN' AND pg_temp.chance(0.02) THEN v_manual := CASE WHEN v_sub > 8000 THEN 1000 ELSE 500 END; END IF;
  IF p_kind = 'DINE_IN' AND pg_temp.chance(0.07) THEN v_tip := CASE WHEN pg_temp.chance(0.6) THEN 500 ELSE 1000 END; END IF;

  v_disc := (v_sub - v_run) + LEAST(v_manual, GREATEST(0, v_run));
  v_base := round(GREATEST(0, v_run - v_manual) + v_takeaway + v_fee);
  v_tax := round(v_base - v_base / (1 + c.rate / 100));
  v_total := v_base + v_tip;
  v_has_kitchen := EXISTS (SELECT 1 FROM order_items oi JOIN demo_prod p ON p.id = oi.product_id WHERE oi.order_id = v_id AND p.dest = 'CUISINE');
  v_has_bar := EXISTS (SELECT 1 FROM order_items oi JOIN demo_prod p ON p.id = oi.product_id WHERE oi.order_id = v_id AND p.dest = 'BAR');

  IF v_cancel THEN
    UPDATE orders SET status = 'CANCELLED', subtotal = v_sub, discount_amount = v_disc, manual_discount = v_manual, tax = v_tax, total = v_total,
           tip_amount = v_tip, promotion_id = v_promo, discount_reason = CASE WHEN v_manual > 0 THEN 'Client fidèle' END,
           kitchen_status = CASE WHEN v_has_kitchen THEN 'CANCELLED' END, bar_status = CASE WHEN v_has_bar THEN 'CANCELLED' END,
           cancel_reason = pg_temp.pick(ARRAY['Client parti avant d''être servi', 'Erreur de saisie', 'Plat indisponible']),
           updated_at = p_ts + interval '15 minutes'
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  v_paid := p_ts + make_interval(mins => CASE WHEN p_kind = 'DINE_IN' THEN pg_temp.rint(30, 70) WHEN p_kind = 'TAKEAWAY' THEN pg_temp.rint(10, 22) ELSE pg_temp.rint(35, 60) END);
  UPDATE orders SET status = 'COMPLETED', paid_at = v_paid, updated_at = v_paid,
         subtotal = v_sub, discount_amount = v_disc, manual_discount = v_manual, tax = v_tax, total = v_total, tip_amount = v_tip,
         promotion_id = v_promo, discount_reason = CASE WHEN v_manual > 0 THEN pg_temp.pick(ARRAY['Client fidèle', 'Geste commercial']) END,
         kitchen_status = CASE WHEN v_has_kitchen THEN 'READY' END, bar_status = CASE WHEN v_has_bar THEN 'READY' END,
         delivery_status = CASE WHEN p_kind = 'DELIVERY' THEN 'DELIVERED' END, courier_id = CASE WHEN p_kind = 'DELIVERY' THEN pg_temp.uid('livreur') END,
         delivered_at = CASE WHEN p_kind IN ('DELIVERY', 'API') THEN v_paid END,
         courier_status = CASE WHEN p_kind = 'API' THEN 'DELIVERED' END,
         courier_name = CASE WHEN p_kind = 'API' THEN pg_temp.pick(ARRAY['Patrick (Yango)', 'Alex (coursier)', 'Moussa (coursier)']) END,
         api_last_status = CASE WHEN p_kind = 'API' THEN 'COMPLETED' END
  WHERE id = v_id;

  -- Paiement (aucun pour la marketplace : elle encaisse et reverse ensuite)
  IF p_kind <> 'API' THEN
    v_method := CASE WHEN random() < CASE WHEN v_total >= 10000 THEN 0.45 ELSE 0.62 END THEN 'CASH'
                     WHEN random() < 0.75 THEN 'MOBILE' ELSE 'CARD' END;
    IF p_kind = 'DELIVERY' AND v_method = 'CARD' THEN v_method := 'MOBILE'; END IF;
    INSERT INTO payments (order_id, amount, payment_method, status, reference, created_at, updated_at)
    VALUES (v_id, v_total, v_method, 'COMPLETED',
            CASE v_method WHEN 'MOBILE' THEN 'MP' || to_char(v_paid, 'YYMMDD') || '.' || pg_temp.rint(1000, 9999) || '.' || chr(65 + pg_temp.rint(0, 25))
                          WHEN 'CARD' THEN 'TPE-' || pg_temp.rint(100000, 999999) END,
            v_paid, v_paid);
  END IF;

  PERFORM pg_temp.deduct(v_id, v_paid, v_user);
  INSERT INTO demo_events (ts, prio, kind, ref) VALUES (v_paid, 5, 'ORDER', v_id);
  RETURN v_id;
END $f$;

-- Réception de marchandises (receive_goods) + dépenses à régler, comme receiveGoods / recordPurchaseExpenses
CREATE FUNCTION pg_temp.receive(p_sup text, p_ts timestamptz, p_lines jsonb, p_po uuid, p_invoice text) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE
  c demo_ctx%ROWTYPE;
  s demo_sup%ROWTYPE;
  res jsonb; v_receipt uuid; v_number text; g record; v_exp uuid; v_ids uuid[] := '{}';
  v_pay_date date; v_rate numeric;
BEGIN
  SELECT * INTO c FROM demo_ctx;
  SELECT * INTO s FROM demo_sup WHERE k = p_sup;
  IF jsonb_array_length(p_lines) = 0 THEN RETURN NULL; END IF;
  res := receive_goods(c.sid, s.id, p_po, pg_temp.uid('magasin'), p_invoice, NULL, p_lines);
  v_receipt := (res->>'receipt_id')::uuid;
  v_number := res->>'number';
  UPDATE goods_receipts SET received_at = p_ts WHERE id = v_receipt;
  UPDATE stock_movements SET created_at = p_ts WHERE reference_id = v_receipt::text AND structure_id = c.sid;
  UPDATE stocks SET updated_at = p_ts WHERE structure_id = c.sid AND updated_at > p_ts + interval '1 day';
  v_rate := CASE WHEN s.vat THEN c.rate ELSE 0 END;
  v_pay_date := pg_temp.ddate(p_ts) + s.pay_delay;

  FOR g IN
    SELECT CASE WHEN l ? 'ingredient_id' AND NULLIF(l->>'ingredient_id', '') IS NOT NULL THEN 'food' ELSE 'goods' END AS category,
           round(sum((l->>'quantity')::numeric * (l->>'unit_price')::numeric)) AS ht
    FROM jsonb_array_elements(p_lines) l GROUP BY 1
  LOOP
    v_exp := gen_random_uuid();
    INSERT INTO expenses (id, structure_id, supplier_id, category, account, expense_date, label, reference, amount_ht, tax_amount, amount_ttc, status,
                          payment_method, paid_at, payment_account, created_by, created_at)
    VALUES (v_exp, c.sid, s.id, g.category, CASE g.category WHEN 'food' THEN '602' ELSE '601' END, pg_temp.ddate(p_ts),
            left(v_number || COALESCE(' — ' || p_invoice, ''), 250), COALESCE(p_invoice, v_number), g.ht, round(g.ht * v_rate / 100), g.ht + round(g.ht * v_rate / 100),
            CASE WHEN v_pay_date <= c.t_end THEN 'PAID' ELSE 'UNPAID' END,
            CASE WHEN v_pay_date <= c.t_end THEN s.pay END, CASE WHEN v_pay_date <= c.t_end THEN v_pay_date END,
            CASE WHEN v_pay_date <= c.t_end AND s.pay = 'TRANSFER' THEN '521' END, pg_temp.uid('magasin'), p_ts);
    v_ids := v_ids || v_exp;
    INSERT INTO demo_events (ts, prio, kind, ref) VALUES (p_ts, 6, 'EXPENSE', v_exp);
    IF v_pay_date <= c.t_end THEN
      INSERT INTO demo_events (ts, prio, kind, ref) VALUES (pg_temp.at(v_pay_date, 600), 7, 'EXPENSE_PAYMENT', v_exp);
    END IF;
  END LOOP;
  UPDATE goods_receipts SET expense_ids = v_ids WHERE id = v_receipt;
  RETURN v_receipt;
END $f$;

-- Lignes de réapprovisionnement d'un fournisseur : jusqu'à couvrir `p_days` jours de ventes
CREATE FUNCTION pg_temp.reorder_lines(p_sup text, p_days numeric, p_trend numeric) RETURNS jsonb LANGUAGE sql VOLATILE AS $$
  SELECT COALESCE(jsonb_agg(x.line), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('ingredient_id', i.id, 'label', i.name, 'pack_label', i.pack_label, 'pack_size', i.pack_size,
             'quantity', ceil((i.exp_daily * p_trend * p_days - st.quantity) / i.pack_size),
             'unit_price', round(i.cost * i.pack_size * (0.94 + random() * 0.14))) AS line
    FROM demo_ing i JOIN stocks st ON st.ingredient_id = i.id AND st.structure_id = pg_temp.sid()
    WHERE i.sup = p_sup AND st.quantity < i.exp_daily * p_trend * p_days
    UNION ALL
    SELECT jsonb_build_object('product_id', p.id, 'label', p.name, 'pack_label', p.pack_label, 'pack_size', p.pack_size,
             'quantity', ceil((p.exp_daily * p_trend * p_days - st.quantity) / p.pack_size),
             'unit_price', round(p.cost * p.pack_size))
    FROM demo_prod p JOIN stocks st ON st.product_id = p.id AND st.structure_id = pg_temp.sid()
    WHERE p.sup = p_sup AND st.quantity < p.exp_daily * p_trend * p_days
  ) x
$$;

-- Dépense directe (charges), réglée ou non, comme createExpense
CREATE FUNCTION pg_temp.expense(p_sup text, p_cat text, p_account text, p_date date, p_label text, p_ttc numeric, p_vat boolean,
                                p_pay_date date, p_method text, p_ref text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE c demo_ctx%ROWTYPE; v_id uuid := gen_random_uuid(); v_ht numeric; v_tax numeric; v_paid boolean;
BEGIN
  SELECT * INTO c FROM demo_ctx;
  IF p_date > c.t_end THEN RETURN; END IF;
  v_ht := CASE WHEN p_vat THEN round(p_ttc / (1 + c.rate / 100)) ELSE p_ttc END;
  v_tax := p_ttc - v_ht;
  v_paid := p_pay_date IS NOT NULL AND p_pay_date <= c.t_end;
  INSERT INTO expenses (id, structure_id, supplier_id, category, account, expense_date, label, reference, amount_ht, tax_amount, amount_ttc, status,
                        payment_method, paid_at, payment_account, created_by, created_at)
  VALUES (v_id, c.sid, CASE WHEN p_sup IS NOT NULL THEN pg_temp.sup(p_sup) END, p_cat, p_account, p_date, p_label, p_ref, v_ht, v_tax, p_ttc,
          CASE WHEN v_paid THEN 'PAID' ELSE 'UNPAID' END, CASE WHEN v_paid THEN p_method END, CASE WHEN v_paid THEN p_pay_date END,
          CASE WHEN v_paid AND p_method = 'TRANSFER' THEN '521' END, pg_temp.uid('compta'), pg_temp.at(p_date, 540));
  INSERT INTO demo_events (ts, prio, kind, ref) VALUES (pg_temp.at(p_date, 540), 6, 'EXPENSE', v_id);
  IF v_paid THEN INSERT INTO demo_events (ts, prio, kind, ref) VALUES (pg_temp.at(p_pay_date, 620), 7, 'EXPENSE_PAYMENT', v_id); END IF;
END $f$;

-- ── Stock initial (inventaire d'ouverture, 9 jours de ventes) ────────────────

INSERT INTO stocks (structure_id, ingredient_id, quantity, threshold, updated_at)
SELECT pg_temp.sid(), i.id, 0, round(i.exp_daily * 2, 2), pg_temp.at((SELECT t_start FROM demo_ctx), 360) FROM demo_ing i;
INSERT INTO stocks (structure_id, product_id, quantity, threshold, updated_at)
SELECT pg_temp.sid(), p.id, 0, GREATEST(ceil(p.exp_daily * 2), 3), pg_temp.at((SELECT t_start FROM demo_ctx), 360) FROM demo_prod p WHERE p.sup IS NOT NULL;
DO $$
DECLARE r record; c demo_ctx%ROWTYPE;
BEGIN
  SELECT * INTO c FROM demo_ctx;
  FOR r IN SELECT 'ingredient' AS kind, id, ceil(exp_daily * 9 / pack_size) * pack_size AS qty, cost FROM demo_ing
           UNION ALL SELECT 'product', id, ceil(exp_daily * 9 / pack_size) * pack_size, cost FROM demo_prod WHERE sup IS NOT NULL
  LOOP
    PERFORM pg_temp.move(r.kind, r.id, 'IN', r.qty, 'initial_stock', NULL, pg_temp.uid('magasin'), pg_temp.at(c.t_start, 360), r.cost, NULL, 'Inventaire d''ouverture (passage à Shede)');
  END LOOP;
END $$;

-- ── Hôtel : séjours dans les chambres existantes ─────────────────────────────

DO $$
DECLARE
  c demo_ctx%ROWTYPE; rm record; d date; nights int; v_id uuid; v_total numeric; v_tax numeric; v_status text; v_paid boolean; gap int;
  names text[] := ARRAY['M. et Mme Kamgang', 'Dr Alain Fokam', 'Mme Esther Ngo Mbock', 'M. Roland Tchatchoua', 'Famille Simo', 'M. Jean-Pierre Ewodo',
                        'Mme Cécile Nkeng', 'M. Ibrahim Mfondi', 'Mlle Grâce Tamo', 'M. Didier Nana', 'Mme Florence Atangana', 'M. Kevin Djomo',
                        'Équipe ONG Agri-Ouest', 'M. Moïse Talla', 'Mme Rose Mbakop', 'M. Samuel Feudjio', 'Famille Ndjock', 'M. Paul Biya Essomba'];
BEGIN
  SELECT * INTO c FROM demo_ctx;
  FOR rm IN SELECT id, number, COALESCE(price, 25000) AS price, COALESCE(type, 'Standard') AS type FROM rooms WHERE structure_id = c.sid ORDER BY number LOOP
    d := c.t_start + pg_temp.rint(0, 3);
    WHILE d <= c.t_end + 14 LOOP
      nights := CASE WHEN rm.price >= 100000 THEN pg_temp.rint(1, 2) ELSE pg_temp.rint(1, 4) END;
      v_total := nights * rm.price;
      v_tax := round(v_total - v_total / (1 + c.rate / 100));
      v_status := CASE WHEN d + nights <= c.t_end THEN 'COMPLETED' WHEN d <= c.t_end THEN 'IN_PROGRESS' ELSE 'CONFIRMED' END;
      v_paid := v_status = 'COMPLETED';
      v_id := gen_random_uuid();
      INSERT INTO bookings (id, room_id, check_in, check_out, status, created_at, updated_at, phone, guest_name, total_amount, is_paid, tax_amount, tax_rate, prices_include_tax)
      VALUES (v_id, rm.id, (d + time '14:00'), (d + nights + time '11:00'), v_status,
              (d - pg_temp.rint(0, 12) + time '10:30'),
              CASE WHEN v_paid THEN (d + nights + time '11:00') ELSE (d - 1 + time '10:30') END,
              '+237 6' || lpad(pg_temp.rint(50000000, 99999999)::text, 8, '0'), pg_temp.pick(names), v_total, v_paid, v_tax, c.rate, true);
      IF v_paid THEN
        INSERT INTO demo_events (ts, prio, kind, ref) VALUES (pg_temp.at(d + nights, 660), 5, 'BOOKING', v_id);
      END IF;
      gap := CASE WHEN rm.price >= 150000 THEN pg_temp.rint(4, 12) WHEN rm.price >= 100000 THEN pg_temp.rint(2, 8)
                  WHEN rm.price >= 50000 THEN pg_temp.rint(1, 5) ELSE pg_temp.rint(0, 3) END;
      d := d + nights + gap;
    END LOOP;
  END LOOP;
  UPDATE rooms r SET status = 'OCCUPIED' WHERE r.structure_id = c.sid AND EXISTS (SELECT 1 FROM bookings b WHERE b.room_id = r.id AND b.status = 'IN_PROGRESS');
END $$;

-- ── Simulation jour par jour ─────────────────────────────────────────────────

DO $$
DECLARE
  c demo_ctx%ROWTYPE;
  d date; dow int; day_i int; trend numeric; factor numeric; n int; k int; t_min numeric; slot text; kind text; ts timestamptz;
  v_po uuid; v_lines jsonb; r record; v_inv uuid; v_shift_open timestamptz; v_shift_close timestamptz;
  v_expected numeric; v_actual numeric; v_diff numeric; v_cashier text; cur_ts timestamptz;
  v_month_end boolean; v_label_month text;
  months text[] := ARRAY['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
BEGIN
  SELECT * INTO c FROM demo_ctx;
  FOR day_i IN 0..90 LOOP
    d := c.t_start + day_i;
    dow := extract(dow FROM d)::int;
    trend := 0.85 + 0.30 * day_i / 90.0;
    v_month_end := extract(day FROM d + 1) = 1;
    v_label_month := months[extract(month FROM d)::int] || ' ' || extract(year FROM d);

    -- Achats du jour : commandes fournisseurs (SABC, Fotso) préparées le lundi, livrées le mercredi
    IF dow = 1 THEN
      FOREACH kind IN ARRAY ARRAY['sabc', 'fotso'] LOOP
        v_lines := pg_temp.reorder_lines(kind, 10, trend * 1.15);
        IF jsonb_array_length(v_lines) > 0 THEN
          v_po := gen_random_uuid();
          INSERT INTO purchase_orders (id, structure_id, supplier_id, number, status, expected_date, note, total_ht, created_by, sent_at, created_at, updated_at)
          VALUES (v_po, c.sid, pg_temp.sup(kind), next_purchase_number(c.sid, 'BC'), 'SENT', d + 2, 'Commande hebdomadaire du bar',
                  (SELECT round(sum((l->>'quantity')::numeric * (l->>'unit_price')::numeric)) FROM jsonb_array_elements(v_lines) l),
                  pg_temp.uid('magasin'), pg_temp.at(d, 600), pg_temp.at(d, 590), pg_temp.at(d, 600));
          INSERT INTO purchase_order_lines (purchase_order_id, product_id, ingredient_id, supplier_item_id, label, pack_label, pack_size, quantity, unit_price)
          SELECT v_po, NULLIF(l->>'product_id', '')::uuid, NULLIF(l->>'ingredient_id', '')::uuid,
                 (SELECT si.id FROM supplier_items si WHERE si.structure_id = c.sid AND si.supplier_id = pg_temp.sup(kind)
                    AND (si.product_id = NULLIF(l->>'product_id', '')::uuid OR si.ingredient_id = NULLIF(l->>'ingredient_id', '')::uuid) LIMIT 1),
                 l->>'label', l->>'pack_label', (l->>'pack_size')::numeric, (l->>'quantity')::numeric, (l->>'unit_price')::numeric
          FROM jsonb_array_elements(v_lines) l;
        END IF;
      END LOOP;
    END IF;
    IF dow = 3 THEN
      FOR r IN SELECT po.id, s.k FROM purchase_orders po JOIN demo_sup s ON s.id = po.supplier_id
               WHERE po.structure_id = c.sid AND po.status = 'SENT' AND po.expected_date = d LOOP
        SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', pol.product_id, 'ingredient_id', pol.ingredient_id, 'order_line_id', pol.id,
                 'label', pol.label, 'pack_label', pol.pack_label, 'pack_size', pol.pack_size,
                 -- Une fois sur dix, une référence livrée en partie (rupture chez le fournisseur)
                 'quantity', CASE WHEN day_i BETWEEN 40 AND 47 AND pol.label LIKE 'Mützig%' THEN GREATEST(1, pol.quantity - 2) ELSE pol.quantity END,
                 'unit_price', pol.unit_price)), '[]'::jsonb)
        INTO v_lines FROM purchase_order_lines pol WHERE pol.purchase_order_id = r.id;
        PERFORM pg_temp.receive(r.k, pg_temp.at(d, 540), v_lines, r.id, 'FAC-' || upper(r.k) || '-' || to_char(d, 'YYMMDD'));
      END LOOP;
    END IF;
    -- Marché et épicerie (lundi, jeudi), boucherie et poissonnerie (mardi, vendredi) : sans bon de commande
    IF dow IN (1, 4) THEN
      PERFORM pg_temp.receive('marche', pg_temp.at(d, 450), pg_temp.reorder_lines('marche', 5.5, trend * 1.1), NULL, NULL);
    END IF;
    IF dow = 1 THEN
      PERFORM pg_temp.receive('epicerie', pg_temp.at(d, 470), pg_temp.reorder_lines('epicerie', 10, trend * 1.1), NULL, 'Ticket ' || to_char(d, 'DDMM'));
    END IF;
    IF dow IN (2, 5) THEN
      PERFORM pg_temp.receive('boucherie', pg_temp.at(d, 440), pg_temp.reorder_lines('boucherie', 5, trend * 1.1), NULL, NULL);
      PERFORM pg_temp.receive('poissonnerie', pg_temp.at(d, 455), pg_temp.reorder_lines('poissonnerie', 5, trend * 1.1), NULL, 'Bon ' || to_char(d, 'DDMM'));
    END IF;

    -- Charges récurrentes
    IF extract(day FROM d) = 5 THEN
      PERFORM pg_temp.expense('bailleur', 'rent', '622', d, 'Loyer de ' || v_label_month, 350000, false, d, 'TRANSFER', 'QUITTANCE-' || to_char(d, 'YYYYMM'));
    END IF;
    IF extract(day FROM d) = 3 THEN
      PERFORM pg_temp.expense('mtn', 'telecom', '628', d, 'Internet Box MTN — ' || v_label_month, 35000, true, d, 'MOBILE', 'MTN-' || to_char(d, 'YYYYMM'));
    END IF;
    IF extract(day FROM d) = 10 THEN
      PERFORM pg_temp.expense('eneo', 'electricity', '6052', d, 'Facture ENEO — consommation de ' || months[extract(month FROM d - 15)::int], 185000 + pg_temp.rint(0, 50) * 1000, true, d + 8, 'MOBILE', 'ENEO-' || to_char(d, 'YYYYMM'));
    END IF;
    IF extract(day FROM d) = 12 THEN
      PERFORM pg_temp.expense('camwater', 'water', '6051', d, 'Facture CAMWATER — ' || months[extract(month FROM d - 15)::int], 32000 + pg_temp.rint(0, 13) * 1000, true, d + 8, 'MOBILE', 'CAMW-' || to_char(d, 'YYYYMM'));
    END IF;
    IF dow = 2 THEN
      PERFORM pg_temp.expense('tradex', 'energy', '6053', d, 'Gaz de cuisine — 2 bouteilles de 12,5 kg', 13000, true, d, 'CASH');
      PERFORM pg_temp.expense(NULL, 'transport', '618', d, 'Transport des achats du marché (semaine)', 6000, false, d, 'CASH');
    END IF;
    IF extract(day FROM d) IN (1, 16) THEN
      PERFORM pg_temp.expense('epicerie', 'packaging', '608', d, 'Emballages à emporter (barquettes, sachets, couverts)', 28000, false, d, 'CASH');
    END IF;
    IF extract(day FROM d) = 20 THEN
      PERFORM pg_temp.expense('media', 'advertising', '627', d, 'Publicité Facebook et WhatsApp — ' || v_label_month, 25000, false, d, 'MOBILE');
    END IF;
    IF extract(day FROM d) = 25 THEN
      PERFORM pg_temp.expense('kenmogne', 'maintenance', '624', d, 'Entretien du groupe électrogène (vidange, filtres)', 45000, false, d, 'CASH');
      PERFORM pg_temp.expense(NULL, 'office', '6055', d, 'Rouleaux de caisse et fournitures de bureau', 15000, false, d, 'CASH');
    END IF;
    IF extract(day FROM d) = 28 THEN
      PERFORM pg_temp.expense('banque', 'bankFees', '631', d, 'Frais de tenue de compte — ' || v_label_month, 6500, true, d, 'TRANSFER');
    END IF;
    IF extract(day FROM d) = 15 THEN
      PERFORM pg_temp.expense(NULL, 'social', '664', d, 'Cotisations CNPS — ' || months[extract(month FROM d - 20)::int], 152000, false, d, 'TRANSFER', 'CNPS-' || to_char(d, 'YYYYMM'));
    END IF;
    IF v_month_end THEN
      PERFORM pg_temp.expense(NULL, 'salaries', '661', d, 'Salaires de ' || v_label_month || ' (11 employés)', 1085000, false, d + 2, 'TRANSFER', 'PAIE-' || to_char(d, 'YYYYMM'));
    END IF;
    IF day_i = 35 THEN
      PERFORM pg_temp.expense(NULL, 'taxes', '641', d, 'Impôt libératoire et taxe communale — trimestre', 75000, false, d, 'TRANSFER', 'DGI-' || to_char(d, 'YYYYMM'));
    END IF;
    IF day_i = 50 THEN
      PERFORM pg_temp.expense('kenmogne', 'maintenance', '624', d, 'Réparation du congélateur (recharge de gaz)', 38000, false, d, 'CASH');
    END IF;

    -- Ventes du jour (plus le week-end, en hausse sur la période)
    factor := CASE dow WHEN 0 THEN 1.15 WHEN 1 THEN 0.75 WHEN 2 THEN 0.80 WHEN 3 THEN 0.85 WHEN 4 THEN 0.95 WHEN 5 THEN 1.25 ELSE 1.45 END;
    factor := factor * COALESCE((SELECT 1 + impact_percent / 100.0 FROM forecast_events WHERE structure_id = c.sid AND event_date = d), 1);
    n := round(34 * factor * trend * (0.9 + random() * 0.2));
    FOR k IN 1..n LOOP
      slot := CASE WHEN random() < 0.12 THEN 'matin' WHEN random() < 0.49 THEN 'midi' ELSE 'soir' END;
      t_min := CASE slot WHEN 'matin' THEN 420 + random() * 210 WHEN 'midi' THEN 690 + random() * 195 ELSE 1080 + random() * 255 END;
      kind := CASE WHEN slot = 'matin' THEN CASE WHEN random() < 0.85 THEN 'DINE_IN' ELSE 'TAKEAWAY' END
                   WHEN random() < 0.79 THEN 'DINE_IN' WHEN random() < 0.55 THEN 'TAKEAWAY' ELSE 'DELIVERY' END;
      ts := pg_temp.at(d, t_min);
      CONTINUE WHEN ts > c.t_now - interval '80 minutes';
      PERFORM pg_temp.new_order(ts, slot, kind);
    END LOOP;
    -- Commandes marketplace (API) sur les six dernières semaines
    IF day_i >= 48 THEN
      FOR k IN 1..pg_temp.rint(0, 3) LOOP
        ts := pg_temp.at(d, CASE WHEN random() < 0.5 THEN 700 + random() * 150 ELSE 1110 + random() * 180 END);
        CONTINUE WHEN ts > c.t_now - interval '80 minutes';
        PERFORM pg_temp.new_order(ts, CASE WHEN extract(hour FROM ts AT TIME ZONE 'Africa/Douala') < 16 THEN 'midi' ELSE 'soir' END, 'API');
      END LOOP;
    END IF;

    -- Pertes déclarées
    IF random() < 0.35 AND d < c.t_end THEN
      SELECT * INTO r FROM (
        SELECT 'ingredient' AS kind, id, name, cost, unit, exp_daily FROM demo_ing WHERE name IN ('Tomates', 'Fruits de saison', 'Waterleaf', 'Poisson bar frais', 'Pain', 'Plantain mûr', 'Feuilles de ndolé lavées')
        UNION ALL SELECT 'product', id, name, cost, 'piece', exp_daily FROM demo_prod WHERE sup IS NOT NULL AND pool IN ('biere', 'boisson')
      ) x ORDER BY random() LIMIT 1;
      kind := CASE WHEN r.kind = 'product' THEN pg_temp.pick(ARRAY['damaged', 'damaged', 'staff_meal', 'other'])
                   ELSE pg_temp.pick(ARRAY['expired', 'expired', 'damaged', 'preparation_error', 'staff_meal']) END;
      PERFORM pg_temp.move(r.kind, r.id, 'OUT',
                           CASE WHEN r.kind = 'product' OR r.unit = 'piece' THEN pg_temp.rint(1, 3) ELSE round((0.3 + random() * 1.2)::numeric, 3) END,
                           'loss', NULL, pg_temp.uid('magasin'), pg_temp.at(d, 960 + random() * 60), r.cost, kind,
                           CASE kind WHEN 'expired' THEN 'Trop mûr, jeté au tri du soir' WHEN 'damaged' THEN 'Casse pendant le service'
                                     WHEN 'staff_meal' THEN 'Repas du personnel' WHEN 'preparation_error' THEN 'Plat raté, refait' ELSE 'Écart constaté' END);
    END IF;

    -- Session de caisse du jour (attendu = fond de caisse + ventes encaissées pendant la session)
    v_cashier := CASE WHEN extract(isodow FROM d) >= 5 THEN 'caisse2' ELSE 'caisse1' END;
    v_shift_open := pg_temp.at(d, 405);
    v_shift_close := pg_temp.at(d, 1420);
    IF d < c.t_end THEN
      v_expected := 50000
        + COALESCE((SELECT sum(total) FROM orders WHERE structure_id = c.sid AND status = 'COMPLETED' AND paid_at BETWEEN v_shift_open - interval '1 minute' AND v_shift_close), 0)
        + COALESCE((SELECT sum(b.total_amount) FROM bookings b JOIN rooms ro ON ro.id = b.room_id
                    WHERE ro.structure_id = c.sid AND b.is_paid AND (b.updated_at AT TIME ZONE 'Africa/Douala') BETWEEN v_shift_open AND v_shift_close), 0);
      v_diff := CASE WHEN random() < 0.82 THEN 0 ELSE (pg_temp.pick(ARRAY['-2000', '-1500', '-1000', '-500', '-500', '500', '1000']))::numeric END;
      INSERT INTO shifts (structure_id, user_id, opened_at, closed_at, opening_balance, expected_amount, actual_amount, difference, notes, status, created_at)
      VALUES (c.sid, pg_temp.uid(v_cashier), v_shift_open, v_shift_close, 50000, v_expected, v_expected + v_diff, v_diff,
              CASE WHEN v_diff < 0 THEN 'Manque constaté au comptage, monnaie rendue en trop' WHEN v_diff > 0 THEN 'Excédent : pourboire laissé dans la caisse' END,
              'CLOSED', v_shift_open);
    END IF;
    -- Aujourd'hui : pas de session ouverte, la formation filme l'ouverture de caisse

    -- Inventaire de fin de mois (validate_inventory) : petits écarts de comptage
    IF v_month_end AND d < c.t_end THEN
      v_inv := gen_random_uuid();
      cur_ts := pg_temp.at(d, 1410);
      INSERT INTO inventories (id, structure_id, status, note, started_by, created_at)
      VALUES (v_inv, c.sid, 'DRAFT', 'Inventaire de fin de ' || v_label_month, pg_temp.uid('magasin'), cur_ts - interval '90 minutes');
      INSERT INTO inventory_lines (inventory_id, item_type, ingredient_id, product_id, counted_quantity, counted_by, counted_at)
      SELECT v_inv, CASE WHEN st.ingredient_id IS NOT NULL THEN 'ingredient' ELSE 'product' END, st.ingredient_id, st.product_id,
             GREATEST(0, round((st.quantity * CASE WHEN random() < 0.7 THEN 1 ELSE 0.94 + random() * 0.05 END)::numeric, CASE WHEN st.product_id IS NOT NULL THEN 0 ELSE 2 END)),
             pg_temp.uid('magasin'), cur_ts - interval '30 minutes'
      FROM stocks st WHERE st.structure_id = c.sid;
      PERFORM validate_inventory(v_inv, pg_temp.uid('gerant'));
      UPDATE inventories SET validated_at = cur_ts WHERE id = v_inv;
      UPDATE stock_movements SET created_at = cur_ts WHERE reference_id = v_inv::text;
    END IF;

    -- Écritures de fin de période : dotations aux amortissements (fin de mois)
    IF v_month_end AND d < c.t_end THEN
      INSERT INTO demo_events (ts, prio, kind, data) VALUES (pg_temp.at(d, 1435), 9, 'DEPRECIATION', jsonb_build_object('as_of', d));
    END IF;
    -- Versements en banque (lundi), reversement marketplace (mercredi), Mobile Money → banque (fin de mois)
    IF dow = 1 AND day_i > 0 THEN INSERT INTO demo_events (ts, prio, kind) VALUES (pg_temp.at(d, 630), 8, 'DEPOSIT'); END IF;
    IF dow = 3 AND day_i > 50 THEN INSERT INTO demo_events (ts, prio, kind) VALUES (pg_temp.at(d, 640), 8, 'MARKETPLACE'); END IF;
    IF v_month_end AND d < c.t_end THEN INSERT INTO demo_events (ts, prio, kind) VALUES (pg_temp.at(d, 1430), 8, 'MOMO'); END IF;
  END LOOP;

  -- Promotions : nombre d'utilisations
  UPDATE promotions p SET used_count = (SELECT count(*) FROM orders o WHERE o.promotion_id = p.id AND o.status = 'COMPLETED') WHERE p.structure_id = c.sid;
END $$;

-- ── Commandes en cours (écrans cuisine, bar, caisse au moment de la démo) ────

DO $$
DECLARE c demo_ctx%ROWTYPE; v_id uuid; r record; i int; v_tables uuid[];
BEGIN
  SELECT * INTO c FROM demo_ctx;
  -- La table « Table 4 » reste libre : la formation y installe des clients
  SELECT array_agg(id) INTO v_tables FROM (SELECT id FROM tables WHERE structure_id = c.sid AND name <> 'Table 4' ORDER BY random() LIMIT 4) t;
  FOR r IN SELECT * FROM (VALUES (1, 'PENDING', 'PENDING', 'PENDING', 4), (2, 'IN_PROGRESS', 'IN_PROGRESS', 'READY', 12),
                                 (3, 'IN_PROGRESS', 'PENDING', 'IN_PROGRESS', 7), (4, 'READY', 'READY', 'READY', 26)) AS v(n, status, kitchen, bar, minutes) LOOP
    v_id := gen_random_uuid();
    INSERT INTO orders (id, structure_id, user_id, status, created_at, updated_at, source, consumption_type, table_id, covers, kitchen_status, bar_status,
                        subtotal, discount_amount, tax, total, tax_rate, prices_include_tax)
    VALUES (v_id, c.sid, pg_temp.uid(pg_temp.pick(ARRAY['serveur1', 'serveur2', 'serveur3'])), r.status,
            c.t_now - make_interval(mins => r.minutes), c.t_now - make_interval(mins => r.minutes), 'CAISSE', 'DINE_IN',
            v_tables[r.n], pg_temp.rint(2, 4), r.kitchen, r.bar, 0, 0, 0, 0, c.rate, true);
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, created_at, is_price_counted, held, fired_at)
    SELECT v_id, p.id, q, p.price, p.price * q, c.t_now - make_interval(mins => r.minutes), true, false, c.t_now - make_interval(mins => r.minutes)
    FROM (SELECT id, price, pg_temp.rint(1, 2) AS q FROM demo_prod WHERE pool = 'plat' ORDER BY random() LIMIT 2) p;
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, created_at, is_price_counted, held, fired_at)
    SELECT v_id, p.id, q, p.price, p.price * q, c.t_now - make_interval(mins => r.minutes), true, false, c.t_now - make_interval(mins => r.minutes)
    FROM (SELECT id, price, pg_temp.rint(1, 3) AS q FROM demo_prod WHERE pool IN ('biere', 'boisson') ORDER BY random() LIMIT 2) p;
    INSERT INTO order_accompaniments (order_id, parent_order_item_id, accompaniment_id, quantity, unit_price_snapshot, total_price_snapshot, is_price_counted)
    SELECT v_id, oi.id, (SELECT id FROM demo_acc ORDER BY random() LIMIT 1), oi.quantity, 500, 500 * oi.quantity, true
    FROM order_items oi JOIN demo_prod p ON p.id = oi.product_id WHERE oi.order_id = v_id AND p.accomp;
    UPDATE orders o SET subtotal = x.s, total = x.s, tax = round(x.s - x.s / (1 + c.rate / 100))
    FROM (SELECT (SELECT COALESCE(sum(total_price), 0) FROM order_items WHERE order_id = v_id)
               + (SELECT COALESCE(sum(total_price_snapshot), 0) FROM order_accompaniments WHERE order_id = v_id) AS s) x
    WHERE o.id = v_id;
    UPDATE tables SET status = 'OCCUPIED' WHERE id = v_tables[r.n];
  END LOOP;
END $$;

-- ── Livraisons en cours (écran livreur) ───────────────────────────────────────

DO $$
DECLARE c demo_ctx%ROWTYPE; v_id uuid; r record; z record; v_sub numeric;
BEGIN
  SELECT * INTO c FROM demo_ctx;
  FOR r IN SELECT * FROM (VALUES
      (1, 'TO_ASSIGN', NULL::text, 'Centre-ville', 'Quartier administratif', 'Immeuble bleu, 2e étage', 'Mireille F.', 18),
      (2, 'ASSIGNED', 'livreur', 'Foto — campus universitaire', 'Cité U', 'Portail principal, bloc C', 'Christian N.', 34)
    ) AS v(n, status, courier, zone, district, landmark, customer, minutes) LOOP
    SELECT * INTO z FROM demo_zone WHERE name = r.zone;
    v_id := gen_random_uuid();
    INSERT INTO orders (id, structure_id, user_id, status, created_at, updated_at, source, consumption_type, kitchen_status, bar_status,
                        delivery_status, courier_id, delivery_fee, delivery_zone_id, delivery_zone_name, delivery_city, delivery_district, delivery_landmark,
                        phone, customer_name, subtotal, discount_amount, tax, total, tax_rate, prices_include_tax)
    VALUES (v_id, c.sid, pg_temp.uid('caisse1'), 'READY', c.t_now - make_interval(mins => r.minutes), c.t_now - make_interval(mins => r.minutes), 'CAISSE', 'DELIVERY',
            'READY', 'READY', r.status, CASE WHEN r.courier IS NOT NULL THEN pg_temp.uid(r.courier) END, z.fee, z.id, z.name, 'Dschang', r.district, r.landmark,
            '+237 6' || lpad(pg_temp.rint(50000000, 99999999)::text, 8, '0'), r.customer, 0, 0, 0, 0, c.rate, true);
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, created_at, is_price_counted, held, fired_at)
    SELECT v_id, p.id, q, p.price, p.price * q, c.t_now - make_interval(mins => r.minutes), true, false, c.t_now - make_interval(mins => r.minutes)
    FROM (SELECT id, price, CASE WHEN pool = 'plat' THEN pg_temp.rint(1, 2) ELSE 2 END AS q FROM demo_prod
          WHERE name IN (CASE r.n WHEN 1 THEN 'Poulet DG' ELSE 'Ndolé aux crevettes' END, CASE r.n WHEN 1 THEN 'Poisson braisé' ELSE 'Brochettes de bœuf (×4)' END, 'Top Pamplemousse (35 cl)')) p;
    INSERT INTO order_accompaniments (order_id, parent_order_item_id, accompaniment_id, quantity, unit_price_snapshot, total_price_snapshot, is_price_counted)
    SELECT v_id, oi.id, (SELECT id FROM demo_acc WHERE name = 'Plantain mûr frit'), oi.quantity, 500, 500 * oi.quantity, true
    FROM order_items oi JOIN demo_prod p ON p.id = oi.product_id WHERE oi.order_id = v_id AND p.accomp;
    SELECT (SELECT COALESCE(sum(total_price), 0) FROM order_items WHERE order_id = v_id)
         + (SELECT COALESCE(sum(total_price_snapshot), 0) FROM order_accompaniments WHERE order_id = v_id) INTO v_sub;
    UPDATE orders SET subtotal = v_sub, total = v_sub + z.fee, tax = round((v_sub + z.fee) - (v_sub + z.fee) / (1 + c.rate / 100)) WHERE id = v_id;
  END LOOP;
END $$;

-- ── Factures clients (devis, factures, avoir, paiements) ─────────────────────

DO $$
DECLARE
  c demo_ctx%ROWTYPE; v_id uuid; v_quote uuid; v_inv uuid; v_pay uuid; d date;
  docs jsonb := '[
    {"key":"q1","cust":"univ","kind":"QUOTE","day":5,"subject":"Séminaire « Agriculture durable » — 2 jours, 45 participants","status":"CONVERTED",
     "lines":[["Pauses-café (2 par jour)",90,1500,"706"],["Déjeuners buffet",90,4000,"706"],["Location de la salle de conférence (jour)",2,50000,"706"]]},
    {"key":"f1","cust":"univ","kind":"INVOICE","day":20,"source":"q1","subject":"Séminaire « Agriculture durable » — 2 jours, 45 participants",
     "lines":[["Pauses-café (2 par jour)",90,1500,"706"],["Déjeuners buffet",90,4000,"706"],["Location de la salle de conférence (jour)",2,50000,"706"]],
     "payments":[[40,0.6,"TRANSFER","VIR UDS 0458"],[62,0.4,"TRANSFER","VIR UDS 0612"]]},
    {"key":"f2","cust":"commune","kind":"INVOICE","day":30,"subject":"Cocktail de bienvenue — délégation régionale (120 personnes)",
     "lines":[["Cocktail dînatoire (par personne)",120,3500,"706"],["Boissons (bières et jus)",240,800,"701"]]},
    {"key":"f3","cust":"ong","kind":"INVOICE","day":48,"subject":"Mission terrain — hébergement et repas de l''équipe",
     "lines":[["Nuitées chambre standard",6,25000,"706"],["Repas (déjeuner et dîner)",18,3500,"706"]],
     "payments":[[60,1,"CHEQUE","CHQ 2215478"]]},
    {"key":"a1","cust":"ong","kind":"CREDIT_NOTE","day":52,"source":"f3","subject":"Avoir — une nuitée non consommée",
     "lines":[["Nuitée chambre standard non consommée",1,25000,"706"]]},
    {"key":"f4","cust":"cabinet","kind":"INVOICE","day":70,"subject":"Déjeuners d''affaires du mois (forfait)",
     "lines":[["Déjeuner d''affaires (menu complet)",12,6000,"706"]]},
    {"key":"q2","cust":"afriland","kind":"QUOTE","day":80,"subject":"Soirée de fin d''année du personnel (60 personnes)","status":"ISSUED",
     "lines":[["Dîner buffet (par personne)",60,7500,"706"],["Boissons (forfait par personne)",60,3000,"701"],["Privatisation de la terrasse",1,100000,"706"]]},
    {"key":"f5","cust":"univ","kind":"INVOICE","day":85,"subject":"Pause-café — soutenances de master",
     "lines":[["Pause-café",30,1500,"706"]]},
    {"key":"d1","cust":"commune","kind":"INVOICE","day":88,"subject":"Repas des élus — conseil municipal de novembre","status":"DRAFT",
     "lines":[["Déjeuner (par personne)",25,4500,"706"]]}
  ]';
  doc jsonb; line jsonb; p record; pos int; v_ht numeric; v_tax numeric; v_sub numeric; v_taxsum numeric;
  ids jsonb := '{}';
BEGIN
  SELECT * INTO c FROM demo_ctx;
  FOR doc IN SELECT * FROM jsonb_array_elements(docs) LOOP
    d := c.t_start + (doc->>'day')::int;
    CONTINUE WHEN d > c.t_end;
    v_id := gen_random_uuid();
    ids := ids || jsonb_build_object(doc->>'key', v_id);
    INSERT INTO sales_documents (id, structure_id, customer_id, kind, status, issue_date, due_date, subject, source_document_id, created_by, created_at, updated_at)
    VALUES (v_id, c.sid, (SELECT id FROM demo_cust WHERE k = doc->>'cust'), doc->>'kind', 'DRAFT', d,
            CASE WHEN doc->>'kind' = 'INVOICE' THEN d + (SELECT terms FROM demo_cust WHERE k = doc->>'cust') END,
            doc->>'subject', NULLIF(ids->>(doc->>'source'), '')::uuid, pg_temp.uid('compta'), pg_temp.at(d, 600), pg_temp.at(d, 600));
    pos := 0; v_sub := 0; v_taxsum := 0;
    FOR line IN SELECT * FROM jsonb_array_elements(doc->'lines') LOOP
      v_ht := round((line->>1)::numeric * (line->>2)::numeric);
      v_tax := round(v_ht * c.rate / 100);
      INSERT INTO sales_document_lines (document_id, position, description, quantity, unit_price, discount_percent, tax_rate, account, total_ht, tax_amount)
      VALUES (v_id, pos, line->>0, (line->>1)::numeric, (line->>2)::numeric, 0, c.rate, line->>3, v_ht, v_tax);
      pos := pos + 1; v_sub := v_sub + v_ht; v_taxsum := v_taxsum + v_tax;
    END LOOP;
    UPDATE sales_documents SET subtotal_ht = v_sub, tax_amount = v_taxsum, total_ttc = v_sub + v_taxsum WHERE id = v_id;
    IF COALESCE(doc->>'status', 'ISSUED') <> 'DRAFT' THEN
      PERFORM issue_sales_document(v_id);
      UPDATE sales_documents SET issued_at = pg_temp.at(d, 610), updated_at = pg_temp.at(d, 610) WHERE id = v_id;
      IF doc->>'kind' IN ('INVOICE', 'CREDIT_NOTE') THEN
        INSERT INTO demo_events (ts, prio, kind, ref) VALUES (pg_temp.at(d, 610), 6, 'SALES_DOCUMENT', v_id);
      END IF;
      IF doc->>'status' IN ('CONVERTED', 'ACCEPTED') THEN UPDATE sales_documents SET status = doc->>'status' WHERE id = v_id; END IF;
    END IF;
  END LOOP;

  -- Encaissements, dans l'ordre des dates (après les avoirs) ; la fraction porte sur le TTC, plafonnée au reste dû
  FOR p IN SELECT doc2->>'key' AS k, pay FROM jsonb_array_elements(docs) doc2, jsonb_array_elements(COALESCE(doc2->'payments', '[]'::jsonb)) pay
           ORDER BY (pay->>0)::int LOOP
    d := c.t_start + (p.pay->>0)::int;
    CONTINUE WHEN d > c.t_end OR NOT ids ? p.k;
    v_id := (ids->>p.k)::uuid;
    v_pay := record_sales_payment(v_id,
               (SELECT LEAST(total_ttc - amount_paid - amount_credited, round(total_ttc * (p.pay->>1)::numeric)) FROM sales_documents WHERE id = v_id),
               p.pay->>2, d, p.pay->>3, pg_temp.uid('compta'));
    UPDATE sales_payments SET treasury_account = CASE p.pay->>2 WHEN 'CHEQUE' THEN '513' ELSE '521' END, created_at = pg_temp.at(d, 640) WHERE id = v_pay;
    INSERT INTO demo_events (ts, prio, kind, ref) VALUES (pg_temp.at(d, 640), 7, 'SALES_PAYMENT', v_pay);
  END LOOP;
END $$;

-- ── Numéros de facture : dans l'ordre des encaissements (commandes et séjours) ─

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT ref, kind FROM demo_events WHERE kind IN ('ORDER', 'BOOKING') ORDER BY ts, ref LOOP
    PERFORM assign_invoice_number(r.kind, r.ref);
  END LOOP;
END $$;

-- ── Écritures comptables, dans l'ordre chronologique ─────────────────────────

INSERT INTO demo_events (ts, prio, kind) SELECT pg_temp.at(t_start, 1), 0, 'OPENING' FROM demo_ctx;
INSERT INTO demo_events (ts, prio, kind, ref) SELECT pg_temp.at(c.t_start + a.day_offset, 900), 6, 'ASSET_ACQUISITION', a.id FROM demo_asset a, demo_ctx c WHERE NOT a.before_start;
INSERT INTO demo_events (ts, prio, kind, ref) SELECT pg_temp.at(c.t_start + a.day_offset + 4, 660), 7, 'ASSET_PAYMENT', a.id FROM demo_asset a, demo_ctx c WHERE NOT a.before_start AND c.t_start + a.day_offset + 4 <= c.t_end;

CREATE FUNCTION pg_temp.post(p_ts timestamptz, p_journal text, p_label text, p_ref text, p_source text, p_source_id uuid, p_lines jsonb) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE v_id uuid;
BEGIN
  v_id := post_accounting_entry(pg_temp.sid(), p_journal, pg_temp.ddate(p_ts), left(p_label, 250), p_ref, p_source, p_source_id, NULL, pg_temp.uid('compta'),
                                (SELECT jsonb_agg(l) FROM jsonb_array_elements(p_lines) l WHERE COALESCE((l->>'debit')::numeric, 0) > 0 OR COALESCE((l->>'credit')::numeric, 0) > 0));
  UPDATE accounting_entries SET created_at = p_ts WHERE id = v_id;
  RETURN v_id;
END $f$;

CREATE FUNCTION pg_temp.balance(p_account text, p_until date) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT COALESCE(sum(debit - credit), 0) FROM accounting_lines WHERE structure_id = pg_temp.sid() AND account = p_account AND entry_date <= p_until
$$;

DO $$
DECLARE
  c demo_ctx%ROWTYPE; e record; o record; b record; x record; a record; v_entry uuid; v_lines jsonb; v_amount numeric;
  v_weights jsonb; v_net numeric; v_sum numeric; v_alloc numeric; v_heavy text; v_acc text; w record; v_rest numeric;
  v_open jsonb; v_capital numeric;
BEGIN
  SELECT * INTO c FROM demo_ctx;
  FOR e IN SELECT * FROM demo_events ORDER BY ts, prio, ref LOOP
    CASE e.kind

    WHEN 'OPENING' THEN
      -- Reprise des soldes au passage à Shede (immobilisations, trésorerie, capital)
      v_open := jsonb_build_array(
        jsonb_build_object('account', '521', 'debit', 4800000, 'label', 'Banque Afriland — solde repris'),
        jsonb_build_object('account', '571', 'debit', 180000, 'label', 'Caisse — solde repris'),
        jsonb_build_object('account', '552', 'debit', 120000, 'label', 'Mobile Money — solde repris'));
      FOR a IN SELECT * FROM demo_asset WHERE before_start LOOP
        v_open := v_open || jsonb_build_array(
          jsonb_build_object('account', a.asset_account, 'debit', a.cost, 'label', a.name),
          jsonb_build_object('account', a.dep_account, 'credit', pg_temp.cumdep(a.cost, a.months, c.t_start + a.day_offset, c.t_start - 1), 'label', 'Amortissements cumulés — ' || a.name));
      END LOOP;
      SELECT sum(COALESCE((l->>'debit')::numeric, 0) - COALESCE((l->>'credit')::numeric, 0)) INTO v_capital FROM jsonb_array_elements(v_open) l;
      v_open := v_open || jsonb_build_array(jsonb_build_object('account', '101', 'credit', v_capital, 'label', 'Capital et apports de l''exploitant'));
      v_entry := pg_temp.post(e.ts, 'AN', 'À-nouveaux — reprise des soldes au passage à Shede', 'REPRISE', 'OPENING', NULL, v_open);
      INSERT INTO fixed_asset_depreciations (structure_id, asset_id, period_end, amount, entry_id, created_at)
      SELECT c.sid, a2.id, c.t_start - 1, pg_temp.cumdep(a2.cost, a2.months, c.t_start + a2.day_offset, c.t_start - 1), v_entry, e.ts
      FROM demo_asset a2 WHERE a2.before_start AND pg_temp.cumdep(a2.cost, a2.months, c.t_start + a2.day_offset, c.t_start - 1) > 0;

    WHEN 'ORDER' THEN
      -- Comme postOrderSale : trésorerie par moyen de paiement (ou 4111 marketplace), ventes HT au prorata, TVA, pourboires
      SELECT * INTO o FROM orders WHERE id = e.ref;
      v_net := GREATEST(0, o.total - o.tax - o.tip_amount);
      SELECT jsonb_build_object(
               '701', COALESCE(sum(oi.total_price) FILTER (WHERE p.destination = 'BAR'), 0),
               '7062', COALESCE(sum(oi.total_price) FILTER (WHERE p.destination <> 'BAR'), 0)
                       + (SELECT COALESCE(sum(total_price_snapshot), 0) FROM order_accompaniments WHERE order_id = o.id),
               '707', COALESCE(o.delivery_fee, 0) + COALESCE(o.takeaway_fee, 0))
      INTO v_weights FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id;
      SELECT sum(value::numeric) INTO v_sum FROM jsonb_each_text(v_weights);
      v_lines := '[]'; v_alloc := 0; v_heavy := NULL;
      FOR w IN SELECT key, value::numeric AS weight FROM jsonb_each_text(v_weights) WHERE value::numeric > 0 ORDER BY value::numeric DESC LOOP
        v_heavy := COALESCE(v_heavy, w.key);
        v_amount := round(v_net * w.weight / v_sum);
        v_alloc := v_alloc + v_amount;
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('account', w.key, 'credit', v_amount));
      END LOOP;
      -- Écart d'arrondi sur le poste le plus lourd (allocate)
      v_lines := (SELECT jsonb_agg(CASE WHEN l->>'account' = v_heavy THEN jsonb_set(l, '{credit}', to_jsonb((l->>'credit')::numeric + v_net - v_alloc)) ELSE l END) FROM jsonb_array_elements(v_lines) l);
      IF o.source = 'API' THEN
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('account', '4111', 'debit', o.total, 'label', 'Reste dû vente ' || o.invoice_number));
      ELSE
        v_lines := v_lines || COALESCE((SELECT jsonb_agg(jsonb_build_object('account', CASE p.payment_method WHEN 'CASH' THEN '571' WHEN 'MOBILE' THEN '552' WHEN 'CARD' THEN '521' ELSE '571' END, 'debit', sum_amount))
                                        FROM (SELECT payment_method, sum(amount) AS sum_amount FROM payments WHERE order_id = o.id AND status = 'COMPLETED' GROUP BY payment_method) p), '[]');
      END IF;
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('account', '4431', 'credit', o.tax),
                                              jsonb_build_object('account', '471', 'credit', o.tip_amount, 'label', 'Pourboires vente ' || o.invoice_number));
      PERFORM pg_temp.post(e.ts, 'VE', 'Vente ' || COALESCE(o.invoice_number, upper(left(o.id::text, 8))), o.invoice_number, 'ORDER', o.id, v_lines);

    WHEN 'BOOKING' THEN
      SELECT bk.*, ro.number AS room_number INTO b FROM bookings bk JOIN rooms ro ON ro.id = bk.room_id WHERE bk.id = e.ref;
      PERFORM pg_temp.post(e.ts, 'VE', 'Hébergement ' || COALESCE(b.invoice_number, upper(left(b.id::text, 8))) || ' — chambre ' || b.room_number, b.invoice_number, 'BOOKING', b.id,
        jsonb_build_array(jsonb_build_object('account', '571', 'debit', b.total_amount),
                          jsonb_build_object('account', '7061', 'credit', b.total_amount - LEAST(b.total_amount, b.tax_amount)),
                          jsonb_build_object('account', '4431', 'credit', LEAST(b.total_amount, b.tax_amount))));

    WHEN 'EXPENSE' THEN
      -- Comme postExpense : charge HT + TVA récupérable / dette (fournisseur, personnel, CNPS, État)
      SELECT ex.*, m.vat, m.counterpart INTO x FROM expenses ex
      JOIN (VALUES ('goods', '4452', '401'), ('food', '4452', '401'), ('supplies', '4452', '401'), ('water', '4452', '401'), ('electricity', '4452', '401'),
                   ('energy', '4452', '401'), ('office', '4452', '401'), ('packaging', '4452', '401'), ('transport', '4454', '401'), ('rent', '4454', '401'),
                   ('maintenance', '4454', '401'), ('advertising', '4454', '401'), ('telecom', '4454', '401'), ('bankFees', '4454', '401'),
                   ('taxes', NULL, '447'), ('salaries', NULL, '422'), ('social', NULL, '431')) AS m(cat, vat, counterpart) ON m.cat = ex.category
      WHERE ex.id = e.ref;
      v_entry := pg_temp.post(e.ts, 'AC', x.label, x.reference, 'EXPENSE', x.id, jsonb_build_array(
        jsonb_build_object('account', x.account, 'debit', x.amount_ttc - CASE WHEN x.vat IS NOT NULL THEN x.tax_amount ELSE 0 END),
        jsonb_build_object('account', COALESCE(x.vat, '4452'), 'debit', CASE WHEN x.vat IS NOT NULL THEN x.tax_amount ELSE 0 END),
        jsonb_build_object('account', x.counterpart, 'credit', x.amount_ttc, 'supplier_id', CASE WHEN x.counterpart = '401' THEN x.supplier_id END)));
      UPDATE expenses SET entry_id = v_entry WHERE id = x.id;

    WHEN 'EXPENSE_PAYMENT' THEN
      SELECT ex.*, CASE ex.category WHEN 'taxes' THEN '447' WHEN 'salaries' THEN '422' WHEN 'social' THEN '431' ELSE '401' END AS counterpart INTO x
      FROM expenses ex WHERE ex.id = e.ref;
      v_entry := pg_temp.post(e.ts, 'TR', 'Règlement — ' || x.label, x.reference, 'EXPENSE_PAYMENT', x.id, jsonb_build_array(
        jsonb_build_object('account', x.counterpart, 'debit', x.amount_ttc, 'supplier_id', CASE WHEN x.counterpart = '401' THEN x.supplier_id END),
        jsonb_build_object('account', COALESCE(x.payment_account, CASE x.payment_method WHEN 'CASH' THEN '571' WHEN 'MOBILE' THEN '552' WHEN 'CHEQUE' THEN '513' ELSE '521' END), 'credit', x.amount_ttc)));
      UPDATE expenses SET payment_entry_id = v_entry WHERE id = x.id;

    WHEN 'SALES_DOCUMENT' THEN
      -- Comme postSalesDocument : 411 TTC / ventes HT par compte + TVA collectée (avoir : sens inverse)
      SELECT sd.*, cu.name AS customer_name INTO x FROM sales_documents sd JOIN customers cu ON cu.id = sd.customer_id WHERE sd.id = e.ref;
      SELECT jsonb_agg(jsonb_build_object('account', acct, CASE WHEN x.kind = 'INVOICE' THEN 'credit' ELSE 'debit' END, amt)) INTO v_lines
      FROM (SELECT account AS acct, sum(total_ht) AS amt FROM sales_document_lines WHERE document_id = x.id GROUP BY account
            UNION ALL
            SELECT CASE WHEN account IN ('701', '702', '707') THEN '4431' ELSE '4432' END, sum(tax_amount) FROM sales_document_lines WHERE document_id = x.id
            GROUP BY CASE WHEN account IN ('701', '702', '707') THEN '4431' ELSE '4432' END) t;
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('account', '411', 'customer_id', x.customer_id, CASE WHEN x.kind = 'INVOICE' THEN 'debit' ELSE 'credit' END, x.total_ttc));
      v_entry := pg_temp.post(e.ts, 'VE', CASE WHEN x.kind = 'INVOICE' THEN 'Facture ' ELSE 'Avoir ' END || x.number || ' — ' || x.customer_name, x.number,
                              CASE WHEN x.kind = 'INVOICE' THEN 'SALES_INVOICE' ELSE 'SALES_CREDIT_NOTE' END, x.id, v_lines);
      UPDATE sales_documents SET entry_id = v_entry WHERE id = x.id;

    WHEN 'SALES_PAYMENT' THEN
      SELECT sp.*, sd.number, sd.customer_id, cu.name AS customer_name INTO x
      FROM sales_payments sp JOIN sales_documents sd ON sd.id = sp.document_id JOIN customers cu ON cu.id = sd.customer_id WHERE sp.id = e.ref;
      v_entry := pg_temp.post(e.ts, 'TR', 'Encaissement facture ' || x.number || ' — ' || x.customer_name, COALESCE(x.reference, x.number), 'SALES_PAYMENT', x.id,
        jsonb_build_array(jsonb_build_object('account', COALESCE(x.treasury_account, '521'), 'debit', x.amount),
                          jsonb_build_object('account', '411', 'credit', x.amount, 'customer_id', x.customer_id)));
      UPDATE sales_payments SET entry_id = v_entry WHERE id = x.id;

    WHEN 'DEPOSIT' THEN
      -- Versement des espèces en banque : on garde 150 000 FCFA de fond en caisse
      v_amount := floor((pg_temp.balance('571', pg_temp.ddate(e.ts)) - 150000) / 5000) * 5000;
      IF v_amount >= 50000 THEN
        PERFORM pg_temp.post(e.ts, 'TR', 'Versement des espèces en banque — Afriland', 'VRST-' || to_char(pg_temp.ddate(e.ts), 'YYMMDD'), 'MANUAL', NULL,
          jsonb_build_array(jsonb_build_object('account', '521', 'debit', v_amount), jsonb_build_object('account', '571', 'credit', v_amount)));
      END IF;

    WHEN 'MOMO' THEN
      v_amount := floor((pg_temp.balance('552', pg_temp.ddate(e.ts)) - 100000) / 5000) * 5000;
      IF v_amount >= 50000 THEN
        PERFORM pg_temp.post(e.ts, 'TR', 'Virement du compte Mobile Money vers la banque', 'MOMO-' || to_char(pg_temp.ddate(e.ts), 'YYMMDD'), 'MANUAL', NULL,
          jsonb_build_array(jsonb_build_object('account', '521', 'debit', v_amount), jsonb_build_object('account', '552', 'credit', v_amount)));
      END IF;

    WHEN 'MARKETPLACE' THEN
      -- Reversement hebdomadaire de la marketplace, commission de 15 % déduite
      v_amount := pg_temp.balance('4111', pg_temp.ddate(e.ts) - 1);
      IF v_amount > 0 THEN
        v_rest := round(v_amount * 0.15);
        PERFORM pg_temp.post(e.ts, 'TR', 'Reversement Yango Food et Tchop Express (commission 15 % déduite)', 'MKT-' || to_char(pg_temp.ddate(e.ts), 'YYMMDD'), 'MANUAL', NULL,
          jsonb_build_array(jsonb_build_object('account', '521', 'debit', v_amount - v_rest),
                            jsonb_build_object('account', '632', 'debit', v_rest, 'label', 'Commissions des marketplaces'),
                            jsonb_build_object('account', '4111', 'credit', v_amount)));
      END IF;

    WHEN 'ASSET_ACQUISITION' THEN
      SELECT * INTO a FROM demo_asset WHERE id = e.ref;
      v_entry := pg_temp.post(e.ts, 'OD', 'Acquisition d’immobilisation — ' || a.name, (SELECT reference FROM fixed_assets WHERE id = a.id), 'ASSET_ACQUISITION', a.id,
        jsonb_build_array(jsonb_build_object('account', a.asset_account, 'debit', a.cost), jsonb_build_object('account', '481', 'credit', a.cost)));
      UPDATE fixed_assets SET acquisition_entry_id = v_entry WHERE id = a.id;

    WHEN 'ASSET_PAYMENT' THEN
      SELECT * INTO a FROM demo_asset WHERE id = e.ref;
      PERFORM pg_temp.post(e.ts, 'TR', 'Règlement — ' || a.name || ' (' || a.vendor || ')', (SELECT reference FROM fixed_assets WHERE id = a.id), 'MANUAL', NULL,
        jsonb_build_array(jsonb_build_object('account', '481', 'debit', a.cost), jsonb_build_object('account', '521', 'credit', a.cost)));

    WHEN 'DEPRECIATION' THEN
      -- Comme postDepreciations : cumul à la date moins ce qui est déjà passé, une écriture 681 / 28x
      CREATE TEMP TABLE IF NOT EXISTS demo_due (asset_id uuid, dep_account text, amount numeric) ON COMMIT DROP;
      TRUNCATE demo_due;
      INSERT INTO demo_due
      SELECT fa.id, fa.depreciation_account,
             pg_temp.cumdep(fa.cost, fa.useful_life_months, fa.in_service_date, (e.data->>'as_of')::date)
             - COALESCE((SELECT sum(amount) FROM fixed_asset_depreciations WHERE asset_id = fa.id), 0)
      FROM fixed_assets fa WHERE fa.structure_id = c.sid AND fa.status = 'ACTIVE' AND fa.depreciation_account IS NOT NULL
        AND fa.in_service_date <= (e.data->>'as_of')::date;
      DELETE FROM demo_due WHERE amount <= 0;
      IF EXISTS (SELECT 1 FROM demo_due) THEN
        v_lines := jsonb_build_array(jsonb_build_object('account', '681', 'debit', (SELECT sum(amount) FROM demo_due)))
                   || (SELECT jsonb_agg(jsonb_build_object('account', dep_account, 'credit', s)) FROM (SELECT dep_account, sum(amount) AS s FROM demo_due GROUP BY dep_account) t);
        v_entry := pg_temp.post(e.ts, 'OD', 'Dotations aux amortissements au ' || to_char((e.data->>'as_of')::date, 'DD/MM/YYYY'), NULL, 'DEPRECIATION', NULL, v_lines);
        INSERT INTO fixed_asset_depreciations (structure_id, asset_id, period_end, amount, entry_id, created_at)
        SELECT c.sid, asset_id, (e.data->>'as_of')::date, amount, v_entry, e.ts FROM demo_due;
      END IF;

    ELSE
      RAISE EXCEPTION 'Événement inconnu : %', e.kind;
    END CASE;
  END LOOP;
END $$;

-- ── Relevés bancaires : mois dernier rapproché, mois en cours à rapprocher ───

DO $$
DECLARE
  c demo_ctx%ROWTYPE; bk demo_bank%ROWTYPE; m_start date; m_end date; cur_start date; v_import uuid; r record; v_line uuid; n int;
BEGIN
  SELECT * INTO c FROM demo_ctx;
  SELECT * INTO bk FROM demo_bank;
  m_start := (date_trunc('month', c.t_end) - interval '1 month')::date;
  m_end := (date_trunc('month', c.t_end) - interval '1 day')::date;
  cur_start := date_trunc('month', c.t_end)::date;

  -- Mois dernier : remises de carte groupées par jour, autres opérations une à une, puis rapprochées
  v_import := gen_random_uuid();
  INSERT INTO bank_statement_imports (id, structure_id, bank_account_id, file_name, line_count, skipped_count, date_from, date_to, created_by, created_at)
  VALUES (v_import, c.sid, bk.main_id, 'releve-afriland-' || to_char(m_start, 'YYYY-MM') || '.csv', 0, 0, m_start, m_end, pg_temp.uid('compta'), pg_temp.at(m_end + 3, 600));
  n := 0;
  FOR r IN
    SELECT al.entry_date + 1 AS value_date, 'REMISE CARTES TPE DU ' || to_char(al.entry_date, 'DD/MM') AS label, 'TPE' || to_char(al.entry_date, 'YYMMDD') AS reference,
           sum(al.debit - al.credit) AS amount, array_agg(al.id) AS line_ids
    FROM accounting_lines al JOIN accounting_entries ae ON ae.id = al.entry_id
    WHERE al.structure_id = c.sid AND al.account = '521' AND ae.source_type = 'ORDER' AND al.entry_date BETWEEN m_start AND m_end - 1
    GROUP BY al.entry_date
    UNION ALL
    SELECT al.entry_date, upper(left(regexp_replace(ae.label, '^Règlement — ', 'VIR EMIS '), 60)), ae.reference, al.debit - al.credit, ARRAY[al.id]
    FROM accounting_lines al JOIN accounting_entries ae ON ae.id = al.entry_id
    WHERE al.structure_id = c.sid AND al.account = '521' AND ae.source_type <> 'ORDER' AND ae.journal <> 'AN' AND al.entry_date BETWEEN m_start AND m_end
    ORDER BY 1
  LOOP
    v_line := gen_random_uuid();
    n := n + 1;
    INSERT INTO bank_statement_lines (id, structure_id, bank_account_id, import_id, value_date, label, reference, amount, status, dedupe_key, created_at)
    VALUES (v_line, c.sid, bk.main_id, v_import, r.value_date, r.label, r.reference, r.amount, 'UNMATCHED',
            r.value_date || '|' || to_char(r.amount, 'FM999999999990.00') || '|' || lower(r.label) || '|' || lower(COALESCE(r.reference, '')) || '|1', pg_temp.at(m_end + 3, 600));
    PERFORM match_bank_lines(v_line, r.line_ids, pg_temp.uid('compta'));
    UPDATE bank_statement_lines SET matched_at = pg_temp.at(m_end + 3, 620) WHERE id = v_line;
  END LOOP;
  -- Une opération de la banque pas encore passée en comptabilité
  INSERT INTO bank_statement_lines (structure_id, bank_account_id, import_id, value_date, label, reference, amount, status, dedupe_key, created_at)
  VALUES (c.sid, bk.main_id, v_import, m_end, 'FRAIS SMS BANKING ' || to_char(m_end, 'MM/YYYY'), NULL, -1500, 'UNMATCHED',
          m_end || '|-1500.00|frais sms banking|' || '|1', pg_temp.at(m_end + 3, 600));
  UPDATE bank_statement_imports SET line_count = n + 1 WHERE id = v_import;

  -- Mois en cours : relevé importé, à rapprocher pendant la démonstration
  IF c.t_end - 2 > cur_start THEN
    v_import := gen_random_uuid();
    INSERT INTO bank_statement_imports (id, structure_id, bank_account_id, file_name, line_count, skipped_count, date_from, date_to, created_by, created_at)
    VALUES (v_import, c.sid, bk.main_id, 'releve-afriland-' || to_char(cur_start, 'YYYY-MM') || '-provisoire.csv', 0, 0, cur_start, c.t_end - 2, pg_temp.uid('compta'), pg_temp.at(c.t_end - 1, 540));
    n := 0;
    FOR r IN
      SELECT al.entry_date + 1 AS value_date, 'REMISE CARTES TPE DU ' || to_char(al.entry_date, 'DD/MM') AS label, 'TPE' || to_char(al.entry_date, 'YYMMDD') AS reference, sum(al.debit - al.credit) AS amount
      FROM accounting_lines al JOIN accounting_entries ae ON ae.id = al.entry_id
      WHERE al.structure_id = c.sid AND al.account = '521' AND ae.source_type = 'ORDER' AND al.entry_date BETWEEN cur_start AND c.t_end - 3
      GROUP BY al.entry_date
      UNION ALL
      SELECT al.entry_date, upper(left(regexp_replace(ae.label, '^Règlement — ', 'VIR EMIS '), 60)), ae.reference, al.debit - al.credit
      FROM accounting_lines al JOIN accounting_entries ae ON ae.id = al.entry_id
      WHERE al.structure_id = c.sid AND al.account = '521' AND ae.source_type <> 'ORDER' AND al.entry_date BETWEEN cur_start AND c.t_end - 2
      UNION ALL
      -- Le cabinet a payé sa facture par virement, pas encore enregistré dans Shede
      SELECT c.t_end - 2, 'VIR RECU CABINET NGANDJEU ET ASSOCIES', 'NGJ-' || to_char(c.t_end - 2, 'MMDD'), sd.total_ttc
      FROM sales_documents sd JOIN demo_cust cu ON cu.id = sd.customer_id WHERE cu.k = 'cabinet' AND sd.kind = 'INVOICE' AND sd.status = 'ISSUED'
      ORDER BY 1
    LOOP
      n := n + 1;
      INSERT INTO bank_statement_lines (structure_id, bank_account_id, import_id, value_date, label, reference, amount, status, dedupe_key, created_at)
      VALUES (c.sid, bk.main_id, v_import, r.value_date, r.label, r.reference, r.amount, 'UNMATCHED',
              r.value_date || '|' || to_char(r.amount, 'FM999999999990.00') || '|' || lower(r.label) || '|' || lower(COALESCE(r.reference, '')) || '|' || n,
              pg_temp.at(c.t_end - 1, 540));
    END LOOP;
    UPDATE bank_statement_imports SET line_count = n WHERE id = v_import;
  END IF;
END $$;

-- ── Prévisions mémorisées (fiabilité), notifications récentes ────────────────

INSERT INTO forecast_snapshots (structure_id, forecast_date, product_id, quantity, revenue, updated_at)
SELECT c.sid, d.day, p.id,
       GREATEST(0, round((COALESCE(s.qty, 0) * (0.86 + random() * 0.28) + random() * 0.6)::numeric, 1)),
       round(GREATEST(0, COALESCE(s.qty, 0) * (0.86 + random() * 0.28)) * p.price),
       pg_temp.at(d.day, 240)
FROM demo_ctx c
CROSS JOIN LATERAL generate_series(c.t_end - 56, c.t_end, interval '1 day') AS g(x)
CROSS JOIN LATERAL (SELECT g.x::date AS day) d
CROSS JOIN demo_prod p
LEFT JOIN LATERAL (
  SELECT sum(oi.quantity) AS qty FROM order_items oi JOIN orders o ON o.id = oi.order_id
  WHERE o.structure_id = c.sid AND o.status = 'COMPLETED' AND oi.product_id = p.id AND pg_temp.ddate(o.paid_at) = d.day
) s ON true
WHERE COALESCE(s.qty, 0) > 0 OR d.day = c.t_end;

INSERT INTO notifications (user_id, structure_id, title, body, url, is_read, created_at)
SELECT u.id, c.sid, v.title, v.body, v.url, v.is_read, c.t_now - make_interval(mins => v.minutes)
FROM demo_ctx c
CROSS JOIN (SELECT c2.admin_id AS id FROM demo_ctx c2 UNION ALL SELECT pg_temp.uid('gerant')) u
CROSS JOIN (VALUES
  ('Commande prête', 'La commande de la table est prête à être servie.', '/orders', false, 9),
  ('Stock bas', 'Feuilles de ndolé lavées : il reste 2,1 kg.', '/stock/ingredients', false, 95),
  ('Marchandises reçues', 'Réception enregistrée auprès de Boucherie Tagne & Fils.', '/purchasing/receipts', true, 400),
  ('Écart de caisse', 'La session de caisse d''hier a été clôturée avec un écart de 1 000 FCFA.', '/shifts', false, 760),
  ('Nouvelle réservation', 'Chambre réservée pour la semaine prochaine.', '/bookings', true, 1500),
  ('Facture en retard', 'Une facture client a dépassé son échéance.', '/accounting/invoices', false, 2900),
  ('Commande marketplace', 'Nouvelle commande Yango Food à accepter.', '/orders', true, 3100)
) AS v(title, body, url, is_read, minutes);

-- ── Numéro de table (chiffres du nom, comme le mode serveur) ; couverts dans la capacité ─

UPDATE orders o SET table_number = NULLIF(regexp_replace(t.name, '\D', '', 'g'), '')::int,
                    covers = CASE WHEN o.status IN ('PENDING', 'IN_PROGRESS', 'READY') THEN LEAST(o.covers, t.capacity) ELSE o.covers END
FROM tables t
WHERE t.id = o.table_id AND o.structure_id = pg_temp.sid();

-- ── Seuils d'alerte réglés par le magasinier ; période comptable clôturée ─────

UPDATE stocks st SET threshold = round(st.quantity * 1.3 + 1)
WHERE st.structure_id = pg_temp.sid()
  AND (st.ingredient_id = (SELECT id FROM demo_ing WHERE name = 'Feuilles de ndolé lavées')
       OR st.product_id = (SELECT id FROM demo_prod WHERE name = 'Guinness (33 cl)'));
UPDATE structures SET accounting_locked_until = (date_trunc('month', (SELECT t_end FROM demo_ctx)) - interval '1 month' - interval '1 day')::date
WHERE id = pg_temp.sid();

-- ── Dates de modification historiques ────────────────────────────────────────
-- Les déclencheurs update_updated_at_column mettent l'heure d'exécution à chaque UPDATE ;
-- le tableau de bord, les sessions de caisse et le pilotage filtrent sur orders.updated_at.

SET LOCAL session_replication_role = replica;
UPDATE orders SET updated_at = CASE WHEN status = 'COMPLETED' THEN paid_at
                                    WHEN status = 'CANCELLED' THEN created_at + interval '15 minutes'
                                    ELSE created_at END
WHERE structure_id = pg_temp.sid();
UPDATE stocks st SET updated_at = COALESCE((SELECT max(m.created_at) FROM stock_movements m
                                            WHERE m.structure_id = st.structure_id
                                              AND (m.ingredient_id = st.ingredient_id OR m.product_id = st.product_id)), st.updated_at)
WHERE st.structure_id = pg_temp.sid();
SET LOCAL session_replication_role = DEFAULT;

-- ── Contrôles finaux ─────────────────────────────────────────────────────────

DO $$
DECLARE c demo_ctx%ROWTYPE; v_d numeric; v_c numeric; v_neg int; v_orders int; v_ca numeric; v_entries int; v_book int;
BEGIN
  SELECT * INTO c FROM demo_ctx;
  SELECT sum(debit), sum(credit) INTO v_d, v_c FROM accounting_lines WHERE structure_id = c.sid;
  IF v_d <> v_c THEN RAISE EXCEPTION 'Comptabilité déséquilibrée : % / %', v_d, v_c; END IF;
  SELECT count(*) INTO v_neg FROM stocks WHERE structure_id = c.sid AND quantity < 0;
  SELECT count(*), sum(total) INTO v_orders, v_ca FROM orders WHERE structure_id = c.sid AND status = 'COMPLETED';
  SELECT count(*) INTO v_entries FROM accounting_entries WHERE structure_id = c.sid;
  SELECT count(*) INTO v_book FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE r.structure_id = c.sid;
  IF EXISTS (SELECT 1 FROM orders WHERE structure_id = c.sid AND status = 'COMPLETED' AND updated_at <> paid_at) THEN
    RAISE EXCEPTION 'Dates de modification des commandes non rétablies';
  END IF;
  RAISE NOTICE 'Démo « La vallé de Bana » du % au % : % commandes payées (% FCFA), % séjours, % écritures (débit = crédit = %), % lignes de stock négatives',
    c.t_start, c.t_end, v_orders, v_ca, v_book, v_entries, v_d, v_neg;
END $$;

COMMIT;
