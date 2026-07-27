# Domain schema (DIG-10)

Source of truth: [`supabase/migrations/20260727010000_domain_schema.sql`](../supabase/migrations/20260727010000_domain_schema.sql)

Applied on **digimenu-db-v2**. RLS is out of scope here → [DIG-11](https://linear.app/cheij-lab/issue/DIG-11).

## Language

All **tables and columns are English**. Product UI / CSV headers may stay Spanish; import/export maps ES↔EN in app code (DIG-14 / Phase 2 CSV).

| CSV / EmDash (ES) | Postgres (EN) |
|-------------------|---------------|
| `restaurantes` | `restaurants` |
| `categorias` | `categories` |
| `productos` | `products` |
| `menu_productos` | `menu_products` |
| `producto_tags` | `product_tags` |
| `nombre` / `descripcion` / `precio` | `name` / `description` / `price` |
| `orden` / `plantilla` | `sort_order` / `template` |
| `activo` / `disponible` | `active` / `available` |
| `restaurante_id` / `categoria_id` / `producto_id` | `restaurant_id` / `category_id` / `product_id` |

## Tables

### `restaurants`
`id` (uuid PK), `slug` (unique), `name`, `description`, `active`, `brand` jsonb, `theme` jsonb, `logo_light_url`, `logo_dark_url`, `created_at`, `updated_at`

### `menus`
`id`, `restaurant_id` → restaurants, `slug`, `name`, `description`, `sort_order`, `template` (default `classic`), `icon`, `active`, timestamps  
Unique: `(restaurant_id, slug)`, `(id, restaurant_id)`

### `categories`
`id`, `restaurant_id`, `slug`, `name`, `icon`, `sort_order`, `cover_url`, `active`, timestamps  
Unique: `(restaurant_id, slug)`, `(id, restaurant_id)`

### `tags`
`id`, `restaurant_id`, `slug`, `name`, `icon`, `active`, timestamps  
Unique: `(restaurant_id, slug)`, `(id, restaurant_id)`

### `products`
`id`, `restaurant_id`, `slug`, `name`, `description`, `price numeric(12,2)`, `category_id` (optional), `image_url`, `active`, `available`, timestamps  
FK `(category_id, restaurant_id)` → `categories (id, restaurant_id)` ON DELETE SET NULL

### `menu_products`
PK `(menu_id, product_id)`, `restaurant_id`, `sort_order`  
Composite FKs keep menu + product in the same restaurant.

### `product_tags`
PK `(product_id, tag_id)`, `restaurant_id`  
Composite FKs keep product + tag in the same restaurant.

### `owner_restaurants`
PK `(user_id, restaurant_id)`, `user_id` → `auth.users`, `restaurant_id` → restaurants, `created_at`  
App cookie / `requireOwner` → DIG-13; policies → DIG-11.

## Integrity notes

- No JSON `string[]` M2M — only junction tables.
- No CMS `status` / `published_at`; use `active` / `available`.
- Media: store public Storage URLs on the row; paths `{restaurant_id}/…` (see [storage.md](./storage.md)).
- `price` is `numeric(12,2)` (not float). JS clients typically see a number/string depending on the driver.
- `updated_at` maintained by trigger `set_updated_at()` on entity tables (not junctions).
