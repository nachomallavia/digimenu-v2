# CSV import plan (DIG-14) — EmDash backup → DigiMenu v2

**Status:** plan only. No importer in this issue. Owner product CSV UI → [DIG-21](https://linear.app/cheij-lab/issue/DIG-21). Full restore is a later one-off/script, not Alpha runtime.

Canonical files: `../digimenu/backups/emdash-2026-07-26/` — inventory in [emdash-backup.md](./emdash-backup.md). Target schema: [schema.md](./schema.md).

## Goals

1. Map ES EmDash CSV columns → EN Postgres tables.
2. Replace ULID PKs with new UUIDs (keep a ULID→UUID map during import).
3. Prefer junction CSVs over pipe-list anti-patterns.
4. Leave media URLs null until objects land in Storage `media/{restaurant_id}/…`.

## Import order

```text
1. restaurants
2. categories, tags          (parallel OK)
3. products                  (needs category map)
4. menus
5. menu_products             (from menu_productos.csv — not menus.productos_ids)
6. product_tags              (parse productos.tags_ids → junctions)
7. owner_restaurants         (fresh Auth user UUIDs — do not trust stub CSV)
```

Skip: `pages.csv`.

## Column map (summary)

| CSV / EmDash | v2 |
|--------------|-----|
| `restaurantes` | `restaurants` |
| `nombre` / `descripcion` / `precio` / `orden` / `plantilla` | `name` / `description` / `price` / `sort_order` / `template` |
| `status` / `published_at` | drop → `active` / `available` |
| `brand_json` / `theme_json` | `brand` / `theme` jsonb |
| `menu_layout_json` | drop |
| `logo_*_id` / `imagen_id` / `cover_id` | `*_url` text null until upload |
| `productos_ids` | ignore; use `menu_productos.csv` → `menu_products` |
| `tags_ids` | parse → `product_tags` |
| ULID `id` / FK ids | new UUID + map |

## ID mapping

- Maintain `Map<ulid, uuid>` (or temp table) while importing.
- Generate `gen_random_uuid()` (or fixed map file) for each entity once; resolve FKs through the map.
- Do not keep ULID as PK in v2.

## Media

Backup has media **ids** only (R2). Plan:

1. Import rows with null URLs.
2. Later: upload binaries to `media/{restaurant_id}/…`, then UPDATE `logo_*_url` / `image_url` / `cover_url`.

## Ownership

`owner_restaurants.csv` in the backup is a stub. After import, link Auth users manually (or DIG-27 onboarding) as in [auth.md](../src/lib/server/auth/auth.md).

## Suggested implementation (later)

- One-off script under `scripts/` using service role (never in browser).
- Or Phase 2 DIG-21 only for **owner product** CSV roundtrip (different from EmDash dump restore).

## Acceptance for DIG-14

- [x] This plan documented
- [x] Demo seed runnable separately ([seed.md](./seed.md)) — not the Finca dump
