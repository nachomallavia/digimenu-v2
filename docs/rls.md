# RLS — restaurant ownership (DIG-11)

Source of truth: [`supabase/migrations/20260727020000_domain_rls.sql`](../supabase/migrations/20260727020000_domain_rls.sql)

Applied on **digimenu-db-v2**. App tenancy cookie / `requireOwner` → [DIG-13](https://linear.app/cheij-lab/issue/DIG-13).

## Access model

| Who | Read | Write |
|-----|------|-------|
| `anon` | Active restaurant + active child rows (junctions if restaurant active) | None |
| `authenticated` | Same as anon **or** all rows for restaurants in `owner_restaurants` | INSERT/UPDATE/DELETE on owned child rows; UPDATE/DELETE on owned `restaurants` |
| `authenticated` on `owner_restaurants` | Own mapping rows only | None (service_role / seed until DIG-27) |
| `service_role` | Full (bypasses RLS) | Full — create restaurants, link owners |

Helper: `public.is_restaurant_owner(uuid)` — `security invoker`, checks `owner_restaurants` for `(select auth.uid())`.

## Policies summary

- **`owner_restaurants`:** SELECT own (`user_id = auth.uid()`). No client writes.
- **`restaurants`:** anon SELECT `active`; authenticated SELECT active **or** owner; UPDATE/DELETE owner only. No client INSERT.
- **Children** (`menus`, `categories`, `tags`, `products`): anon SELECT when row + restaurant `active`; authenticated same **or** owner; writes require ownership.
- **Junctions** (`menu_products`, `product_tags`): anon SELECT when restaurant `active`; authenticated same **or** owner; writes require ownership.

Owners can still **read** other restaurants’ **public active** menus (same as a guest). Isolation for private/inactive data and for **writes** is ownership-scoped.

## Smoke recipe

Synthetic users + two restaurants (A active owned by A; B inactive owned by B):

1. Seed as privileged role (`auth.users`, `restaurants`, `owner_restaurants`, `menus`).
2. `set_config('role','authenticated', true)` + JWT claims `sub` = user A:
   - sees A menus; does **not** see inactive B menus
   - `is_restaurant_owner(A)` true, `is_restaurant_owner(B)` false
   - INSERT menu on A OK; INSERT on B blocked
3. As user B: sees B menus (owner) and public A menus.
4. As `anon`: sees A only; B hidden.
5. Delete smoke fixtures.

DIG-11 run (2026-07-27): all asserts passed; fixtures cleaned.
