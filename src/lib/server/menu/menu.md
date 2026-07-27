# `lib/server/menu`

Public menu loaders and view-model builders for `/m/*` (DIG-23).

Templates under `components/menu/templates` consume the view-model; they do not query the DB.

## Entrypoints

```ts
import {
	preparePublicMenuPage,
	isPreparedPublicMenuPage,
	loadPublicRestaurant,
	buildMenuViewModel,
} from "@/lib/server/menu";
```

| Module | Role |
|--------|------|
| [`load-public-menu.ts`](./load-public-menu.ts) | `loadPublicRestaurant`, `findMenuBySlug` via `lib/server/db` + RLS |
| [`view-model.ts`](./view-model.ts) | `buildMenuViewModel` — sections, chips, membership |
| [`membership.ts`](./membership.ts) | `menu_products` → product↔menu map + sole/synthetic fallbacks |
| [`prepare-public-menu-page.ts`](./prepare-public-menu-page.ts) | Shared `/m/[restaurant]` (+ `/{menu}`) orchestration |
| [`types.ts`](./types.ts) | `MenuViewModel`, `PublicRestaurantLoad` (English fields) |

## Behaviour notes

- No EmDash, no Cloudflare cache hints (DIG-26 later).
- Membership from `menu_products` junctions (not JSON arrays).
- Zero DB menus → synthetic “Carta” (`hasDbMenus: false`, treat empty as all products).
- Multi-menu → `clientMenuSwitch: true` (full catalog in view-model for client switch).
- Filters `active` defensively; exposes `available` on product views.

## Call pattern (pages)

```ts
const prepared = await preparePublicMenuPage(Astro, { initialView: "landing" });
if (!isPreparedPublicMenuPage(prepared)) return prepared;
const { viewModel, title, multiMenu } = prepared;
```
