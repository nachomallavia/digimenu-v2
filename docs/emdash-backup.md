# EmDash CSV backup — inventory (DIG-8)

**Canonical files (do not duplicate into this repo):**  
`/Users/ignaciomallaviabarrena/Documents/programacion/digimenu/backups/emdash-2026-07-26/`  
Relative from digimenu-v2: `../digimenu/backups/emdash-2026-07-26/`

Source (per upstream README): Cloudflare D1 `digimenu-db` via `wrangler d1 execute --remote` on **2026-07-26**.

**Restore into DigiMenu v2 is out of scope here** — mapping/import is DIG-14 / Phase 2 after schema ([docs/schema.md](./schema.md)).

## Entity counts

| File | Data rows | Notes |
|------|-----------|--------|
| `restaurantes.csv` | 1 | Restaurant `finca` |
| `menus.csv` | 7 | Includes legacy `productos_ids` pipe-list |
| `menu_productos.csv` | 145 | Prefer this over `menus.productos_ids` for M2M |
| `categorias.csv` | 15 | |
| `tags.csv` | 3 | |
| `productos.csv` | 86 | Includes `tags_ids` (string list — not a junction CSV) |
| `pages.csv` | 1 | EmDash page — **not** ported to v2 |
| `owner_restaurants.csv` | 0 usable | Header + pending stub (Supabase MCP 502 at export) |

Raw D1 dumps also present: `ec_*.d1.json` (same entities, fuller payloads).

**Media binaries are not in this backup** — only media ids (`logo_*_id`, `imagen_id`, `cover_id`). Objects lived on R2 `digimenu-media`; v2 uses Supabase Storage bucket `media` (see [storage.md](./storage.md)).

## Column cheat-sheet (legacy CSV)

### `restaurantes`
`id`, `slug`, `status`, `nombre`, `descripcion`, `brand_json`, `theme_json`, `menu_layout_json`, `logo_light_id`, `logo_dark_id`, timestamps + `published_at`

### `menus`
`id`, `slug`, `status`, `nombre`, `descripcion`, `restaurante_id`, `orden`, `plantilla`, `icon`, `productos_ids` (**anti-pattern** — use `menu_products`), timestamps

### `menu_productos`
`menu_id`, `producto_id`, `orden`, `restaurante_id`

### `categorias`
`id`, `slug`, `status`, `nombre`, `restaurante_id`, `icon`, `orden`, `cover_id`, timestamps

### `tags`
`id`, `slug`, `status`, `nombre`, `restaurante_id`, `icon`, timestamps

### `productos`
`id`, `slug`, `status`, `nombre`, `descripcion`, `precio`, `restaurante_id`, `categoria_id` (optional), `tags_ids` (**anti-pattern** — need `product_tags` junction), `imagen_id`, timestamps

### `owner_restaurants` (intended)
`user_id`, `restaurant_id`, `created_at` — **re-export from prod Supabase** before relying on it.

## v2 mapping (DIG-10)

| EmDash / CSV | DigiMenu v2 |
|--------------|-------------|
| ULID `id` | New UUID PKs (import maps ULID→UUID) |
| `status` / `published_at` | Drop; use `active` / `available` |
| `brand_json` / `theme_json` | JSONB `brand` / `theme` on `restaurants` |
| `menu_layout_json` | Dropped |
| `productos_ids` / `tags_ids` | Junctions `menu_products`, `product_tags` |
| `logo_*_id` / `imagen_id` / `cover_id` | Storage public URLs under `media/{restaurant_id}/…` |
| `restaurantes` / `categorias` / `productos` | `restaurants` / `categories` / `products` |
| `nombre` / `descripcion` / `precio` / `orden` / `plantilla` | `name` / `description` / `price` (`numeric(12,2)`) / `sort_order` / `template` |
| `pages` | Do not port |
| `owner_restaurants` | `owner_restaurants` (DIG-13 wiring after fresh export) |

Full column list: [schema.md](./schema.md).

## Upstream README

See also: `../digimenu/backups/emdash-2026-07-26/README.md`
