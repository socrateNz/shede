# API Shede v1 — intégration marketplace

> Contenu : authentification, point, menu, commandes et webhooks.

## Authentification

Chaque point de vente possède **sa propre clé** (`shd_live_…`), générée par
l'administrateur de l'organisation dans *Points & licence → fiche du point → API*.
La clé identifie le point : aucune autre information n'est nécessaire.

```http
Authorization: Bearer shd_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

L'en-tête `X-Api-Key: shd_live_…` est aussi accepté.

## Format des réponses

Succès :

```json
{ "data": { ... } }
```

Erreur :

```json
{ "error": { "code": "invalid_key", "message": "Clé d’API invalide ou révoquée." } }
```

Les messages sont en français ou en anglais selon l'en-tête `Accept-Language`.

| Code HTTP | `code` | Signification |
|---|---|---|
| 401 | `missing_key`, `invalid_key` | Clé absente, inconnue ou révoquée |
| 403 | `module_disabled`, `license_inactive`, `point_inactive` | Module API absent, licence expirée, point désactivé |
| 404 | `not_found` | Ressource introuvable |
| 409 | `point_paused` | Le restaurant a mis les commandes marketplace en pause |
| 409 | `invalid_state` | Action impossible dans l'état de la commande (ex. annuler une commande en préparation) |
| 403 | `quota_exceeded` | Quota mensuel de commandes API de l'organisation atteint |
| 422 | `validation_error` | Requête invalide (`details` précise les champs) |
| 429 | `rate_limited` | Plus de 60 appels par minute (voir `Retry-After`) |
| 500 | `internal_error` | Erreur interne |

Chaque réponse indique `X-RateLimit-Limit` et `X-RateLimit-Remaining`.

Montants : francs CFA (XAF), entiers. `price` est le prix saisi par le
restaurant ; `price_with_tax` le prix TTC payé par le client (selon le régime de
TVA du point, indiqué par `tax.prices_include_tax`).

## Points d'accès

### `GET /api/v1/point`

```bash
curl https://<domaine>/api/v1/point -H "Authorization: Bearer $SHEDE_KEY"
```

```json
{
  "data": {
    "id": "…", "name": "Restaurant Le Wouri", "type": "RESTAURANT",
    "phone": "+237 6 71 23 45 67", "address": "Rue Joss", "city": "Douala", "country": "Cameroun",
    "currency": "XAF", "tax": { "rate": 19.25, "prices_include_tax": true },
    "takeaway_fee": 200, "logo_url": null
  }
}
```

### `GET /api/v1/menu`

```bash
curl https://<domaine>/api/v1/menu -H "Authorization: Bearer $SHEDE_KEY"
```

```json
{
  "data": [
    {
      "id": "…", "name": "Poulet DG", "description": "…", "category": "Plats",
      "image_url": "https://…", "price": 4500, "price_with_tax": 4500, "is_available": true,
      "accompaniments": [
        { "id": "…", "name": "Plantains mûrs", "price": 0, "price_with_tax": 0, "max_quantity": 1, "is_available": true }
      ]
    }
  ]
}
```

Les produits indisponibles sont renvoyés avec `is_available: false` : masquez-les
plutôt que de les supprimer.

## Commandes

### Cycle de vie

```
pending_acceptance ──(restaurant accepte)──▶ accepted ──▶ preparing ──▶ ready ──▶ picked_up ──▶ delivered
        │                                        │
        └──(restaurant refuse)──▶ rejected        └──(marketplace annule)──▶ cancelled
```

- **Le restaurant accepte ou refuse** chaque commande dans Shede, et annonce un
  temps de préparation (`prep_minutes`, `estimated_ready_at`).
- **Shede fait foi pour les prix** : le total (TVA du point incluse) est calculé à
  partir des prix du restaurant et renvoyé dans `amounts`.
- **La marketplace encaisse le client** : la vente est clôturée dans Shede quand
  le livreur récupère la commande (`PICKED_UP`).

### `POST /api/v1/orders`

```bash
curl -X POST https://<domaine>/api/v1/orders \
  -H "Authorization: Bearer $SHEDE_KEY" -H "Content-Type: application/json" \
  -d '{
    "external_id": "GLV-48213",
    "partner": "glovo",
    "customer": { "name": "Aïcha N.", "phone": "699123456" },
    "items": [
      { "product_id": "…", "quantity": 2, "notes": "Bien pimenté",
        "accompaniments": [ { "id": "…", "quantity": 1 } ] }
    ],
    "notes": "Sonner au portail",
    "delivery_address": "Bonamoussadi, face Total"
  }'
```

| Champ | Obligatoire | Description |
|---|---|---|
| `external_id` | oui | Numéro de la commande chez la marketplace (unique par point) |
| `partner` | non | Nom de la marketplace (`glovo`, `yango`…) |
| `customer.phone` | oui | Téléphone du client |
| `items[].product_id` | oui | Id d'un produit de `GET /menu` |
| `items[].quantity` | oui | 1 à 99 |
| `items[].accompaniments[]` | non | `id` d'un accompagnement du produit, `quantity` ≤ `max_quantity` |

Réponse `201` : la commande créée (statut `pending_acceptance`).

**Idempotence** : renvoyer la même requête (même `external_id`) ne crée pas de
doublon ; la commande existante est renvoyée avec le code `200`. En cas de
coupure réseau, renvoyez donc simplement la requête.

Erreurs de validation (`422`) — `details[].code` :
`product_not_found`, `product_unavailable`, `accompaniment_not_offered`,
`accompaniment_unavailable`, `accompaniment_quantity_exceeded`.

### `GET /api/v1/orders/{id}`

`{id}` = l'id Shede **ou** votre `external_id`.

```json
{
  "data": {
    "id": "…", "external_id": "GLV-48213", "partner": "glovo",
    "status": "accepted", "prep_minutes": 20, "estimated_ready_at": "2026-10-01T12:35:00.000Z",
    "customer": { "name": "Aïcha N.", "phone": "+237699123456" },
    "items": [ { "product_id": "…", "name": "Poulet DG", "quantity": 2, "unit_price": 4500, "total_price": 9000,
                 "accompaniments": [ { "id": "…", "name": "Plantains mûrs", "quantity": 2, "unit_price": 0, "total_price": 0 } ] } ],
    "amounts": { "currency": "XAF", "subtotal": 9000, "discount": 0, "tax": 1453, "total": 9000 },
    "courier": { "status": null, "name": null, "phone": null },
    "invoice_number": null
  }
}
```

### `GET /api/v1/orders?updated_since=2026-10-01T12:00:00Z&limit=50`

Commandes modifiées depuis une date, de la plus ancienne à la plus récente
(`limit` ≤ 100). Pour suivre les changements, rappelez avec le `updated_at` de la
dernière commande reçue.

### `POST /api/v1/orders/{id}/cancel`

```json
{ "reason": "Client injoignable" }
```

Possible tant que la préparation n'a pas commencé (`pending_acceptance` ou
`accepted`) ; sinon `409 invalid_state`.

### `POST /api/v1/orders/{id}/delivery-events`

```json
{ "status": "PICKED_UP", "courier_name": "Paul", "courier_phone": "677000000" }
```

`status` : `ASSIGNED` → `PICKED_UP` → `DELIVERED` (ou `FAILED` avec `reason`).
Uniquement pour une commande acceptée. `PICKED_UP` (ou `DELIVERED`) clôture la
vente : facture numérotée, stock et comptabilité du restaurant.

## Webhooks

Shede prévient votre serveur dès qu'il se passe quelque chose sur le point.
L'adresse (HTTPS) et le secret de signature sont configurés par le restaurant
dans *fiche du point → API → Webhook* ; demandez-lui de vous transmettre le secret.

### Requête envoyée

```http
POST https://votre-serveur/webhooks/shede
Content-Type: application/json
Shede-Event: order.status_changed
Shede-Delivery: 6f1c…            (identifiant unique de l'envoi)
Shede-Signature: t=1759312345,v1=5d41402abc4b2a76b9719d911017c592…
```

```json
{
  "id": "6f1c…",
  "type": "order.status_changed",
  "created_at": "2026-10-01T12:15:03.000Z",
  "data": { "previous_status": "pending_acceptance", "order": { "…": "même format que GET /orders/{id}" } }
}
```

| `type` | Quand | `data` |
|---|---|---|
| `order.status_changed` | La commande change de statut (acceptée, refusée, en préparation, prête, récupérée, livrée, annulée) | `previous_status`, `order` complète |
| `menu.updated` | Un produit ou un accompagnement est créé, modifié, désactivé ou supprimé | `product_id` ou `accompaniment_id`, `change`, `is_available` → relisez `GET /menu` |
| `point.paused` / `point.resumed` | Le restaurant suspend ou reprend les commandes | `paused` |
| `ping` | Test envoyé depuis Shede | — |

### Répondre

Répondez **2xx en moins de 8 secondes** (traitez l'événement ensuite, de façon
asynchrone). Sinon, l'envoi est retenté après 1 min, 5 min, 30 min, 2 h, 12 h et
24 h, puis abandonné. Un même événement peut donc arriver plusieurs fois :
ignorez un `Shede-Delivery` déjà traité. L'ordre d'arrivée n'est pas garanti :
fiez-vous à `order.updated_at`.

### Vérifier la signature

`v1` = HMAC-SHA256 du texte `"{t}.{corps brut}"` avec le secret. Refusez les
requêtes dont la signature ne correspond pas ou dont `t` a plus de 5 minutes.

```js
import { createHmac, timingSafeEqual } from 'crypto';

function verifyShedeSignature(secret, header, rawBody) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return expected.length === parts.v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}
```

Utilisez le **corps brut** reçu (avant tout `JSON.parse`).
