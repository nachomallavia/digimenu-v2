# CP1 — Domain ready (DIG-15)

Verified **2026-07-27** against digimenu-db-v2 + repo `main`.

## Exit criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Schema + junctions + RLS | PASS | DIG-10/11: 8 tables, RLS on, `is_restaurant_owner`, ~35 policies ([docs/schema.md](./schema.md), [docs/rls.md](./rls.md)) |
| Session / tenancy | PASS | DIG-3 Auth + DIG-13 `requireOwner` / `/app/pending`; cookie deferred by design |
| `lib/db` in place | PASS | DIG-12: `src/lib/domain` + `src/lib/server/db` CRUD/junctions |
| Seed works | PASS | DIG-14: `supabase/seed/demo.sql` → `seed-demo` (1 rest, 2 cat, 2 tags, 4 products, 1 menu, 4 menu_products, 2 product_tags) |

## Live DB snapshot (checkpoint)

- Tables: `restaurants` (2 rows: ops + seed), menus/categories/tags/products/junctions for seed-demo as above
- `owner_restaurants`: ≥1 row (ops-linked Auth user)
- RLS enabled on all domain tables; `is_restaurant_owner` present

## Phase 1 issues

| Issue | Role |
|-------|------|
| [DIG-10](https://linear.app/cheij-lab/issue/DIG-10) | Schema |
| [DIG-11](https://linear.app/cheij-lab/issue/DIG-11) | RLS |
| [DIG-12](https://linear.app/cheij-lab/issue/DIG-12) | lib/db |
| [DIG-13](https://linear.app/cheij-lab/issue/DIG-13) | requireOwner |
| [DIG-14](https://linear.app/cheij-lab/issue/DIG-14) | Seed + CSV plan |

## Explicit deferrals (not CP1 blockers)

- `digimenu_owner` cookie (DIG-13)
- Full EmDash CSV restore (plan only)
- Storage write policies still DIG-5 stubs (ownership tighten later)
- Owner CRUD UI → Phase 2

## Verdict

**CP1 PASS** — domain layer ready for Phase 2 (`/app` parity).
