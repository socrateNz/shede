# Sécurité RLS — Shede

## Principe

| Accès | Clé | RLS |
|--------|-----|-----|
| Navigateur (catalogue client) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Oui** — lecture limitée |
| Server Actions / API Next.js | `SUPABASE_SERVICE_ROLE_KEY` | **Non** (bypass) |

La session utilisateur (cookie JWT maison) **ne remplace pas** Supabase Auth. Toute la logique métier staff reste dans les Server Actions avec la clé service.

## Installation

1. Ouvrir **Supabase → SQL Editor**
2. Exécuter dans l’ordre : `01-create-tables.sql` … `04-add-phone-numbers.sql`, `promotions.sql`, puis **`scripts/05-enable-rls.sql`**
3. Vérifier :

```sql
SET ROLE anon;
SELECT count(*) FROM public.structures;
SELECT count(*) FROM public.users;  -- doit échouer ou retourner 0
RESET ROLE;
```

## Données lisibles en anon (B2C)

- `structures` — licence active
- `licenses` — pour les structures visibles
- `products`, `accompaniments`, `product_accompaniments` — menu disponible
- `rooms` — chambres des établissements visibles
- `promotions` — actives, hors mode `CODE`

**Interdit en anon** : `users` (mots de passe), `orders`, `payments`, codes promo, notifications, etc.

## Rollback

`scripts/05-disable-rls-rollback.sql` — uniquement en développement.

## Middleware Next.js (`middleware.ts`)

Complète le RLS au niveau des **routes** :

| Zone | Accès |
|------|--------|
| `/`, `/login`, `/register-*`, `/docs`, `/cart`, `/client/structure/*` | Public |
| `/client`, `/history` | Rôle `CLIENT` uniquement |
| `/dashboard`, `/orders`, … | Staff (`ADMIN`, `CAISSE`, …) |
| `/structures` | `SUPER_ADMIN` |
| Modules `HOTEL`, `STOCK`, `PROMOTION` | Contrôle via `session.modules` |

La session JWT inclut `licenseActive` (renseigné à la connexion). Si la licence expire en cours de session, `requireAuth()` dans les layouts continue de vérifier en base.

## Évolutions possibles

- Brancher Supabase Auth + JWT custom claims (`structure_id`, `role`) pour des policies staff sans service role côté client
- Restreindre le catalogue au module `CLIENT_APP` via `is_structure_catalog_visible`
