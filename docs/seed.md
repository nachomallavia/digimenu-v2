# Demo seed (DIG-14)

Synthetic mini-catalog for development — **not** a Finca/EmDash restore.

Source: [`supabase/seed/demo.sql`](../supabase/seed/demo.sql)

## What’s included

| Entity | Count | Notes |
|--------|------:|-------|
| restaurants | 1 | slug `seed-demo`, fixed UUID |
| categories | 2 | Cafés, Dulces |
| tags | 2 | Vegano, Sin TACC |
| products | 4 | espresso, latte, brownie, cookie-avena |
| menus | 1 | `carta` |
| menu_products | 4 | all products on carta |
| product_tags | 2 | cookie → both tags |

No images (null URLs). No `owner_restaurants` row.

## How to run

**Supabase Dashboard → SQL Editor:** paste/run `supabase/seed/demo.sql`.

Or MCP / `psql` against digimenu-db-v2 with a privileged role (service role / postgres). RLS blocks client inserts for restaurants.

Safe to re-run (fixed UUIDs + upserts).

Applied on digimenu-db-v2 during DIG-14 (verified counts above).

## Link your Auth user (optional)

To open `/app` as this restaurant:

```sql
insert into public.owner_restaurants (user_id, restaurant_id)
values (
  '<AUTH_USER_UUID>',
  'a0000000-0000-4000-8000-000000000001'
)
on conflict do nothing;
```

See also [auth.md](../src/lib/server/auth/auth.md). If you already linked another restaurant for DIG-13, leave seed-demo unlinked or switch the mapping.

## EmDash / CSV restore

Full backup mapping + Finca runbook: [csv-import-plan.md](./csv-import-plan.md). Inventory: [emdash-backup.md](./emdash-backup.md).

```bash
node scripts/restore-finca-from-emdash.mjs --media-only   # images onto existing finca
node scripts/restore-finca-from-emdash.mjs --force        # wipe + full catalog + media
```
