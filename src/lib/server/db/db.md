# `lib/server/db`

Supabase queries and mutations for domain entities. Pages and Actions call these entrypoints — no EmDash, no service role here.

## Call pattern

```ts
import { listMenusByRestaurant } from "@/lib/server/db";

const menus = await listMenusByRestaurant(Astro.locals.supabase, restaurantId);
```

- First argument is always a request-bound `SupabaseClient` (`locals.supabase` or `createSupabaseServerClient`).
- RLS applies (see [docs/rls.md](../../../../docs/rls.md)).
- `get*` → `T | null`; list → `T[]`; mutations throw `DbError` on Postgrest failure.
- Row types live in [`lib/domain`](../../domain/domain.md).

## Entrypoints

| Area | Functions |
|------|-----------|
| Restaurants | `getRestaurantById`, `getRestaurantBySlug`, `updateRestaurant`, `deleteRestaurant` (no client create — DIG-27 / service seed) |
| Menus | `listMenusByRestaurant`, `getMenuById`, `getMenuBySlug`, `createMenu`, `updateMenu`, `deleteMenu` |
| Categories | `listCategoriesByRestaurant`, `getCategoryById`, `getCategoryBySlug`, `createCategory`, `updateCategory`, `deleteCategory` |
| Tags | `listTagsByRestaurant`, `getTagById`, `getTagBySlug`, `createTag`, `updateTag`, `deleteTag` |
| Products | `listProductsByRestaurant`, `getProductById`, `getProductBySlug`, `createProduct`, `updateProduct`, `deleteProduct` |
| Junctions | `listMenuProducts`, `listMenuProductsByProduct`, `setMenuProducts`, `listProductTags`, `setProductTags` |
| Ownership | `listOwnerRestaurantIds`, `listRestaurantsForUser` |

Re-export barrel: [`index.ts`](./index.ts).

## Orchestration notes

- Tenancy cookie / `requireOwner` → DIG-13 (auth). Db only reads `owner_restaurants` when asked.
- Batch CSV / multi-write orchestration → `lib/server/owner` (Phase 2).
- Public menu loaders/view-model → `lib/server/menu` (Phase 3); they should call this module.
