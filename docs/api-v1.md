# API Shede v1 — intégration marketplace

> État : étape 1 (authentification, point, menu). Les commandes et les webhooks
> arrivent dans les étapes suivantes.

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
