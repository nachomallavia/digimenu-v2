# `lib/domain`

Pure types and helpers (no I/O): brand/theme parsers, shared domain shapes.

## Types (DIG-12)

[`types.ts`](./types.ts) — row shapes for Postgres English schema (`Restaurant`, `Menu`, `Category`, `Tag`, `Product`, junctions, Insert/Update patches). See [docs/schema.md](../../../docs/schema.md).

## Brand / theme (DIG-17)

| Module | Role |
|--------|------|
| [`restaurant-brand.ts`](./restaurant-brand.ts) | Palette + typefaces (`parseRestaurantBrand`, `brandFromFormData`, pick helpers) |
| [`restaurant-theme.ts`](./restaurant-theme.ts) | Semantic public-menu roles from brand (`parseRestaurantTheme`, `themeFromFormData`, CSS var map) |

`restaurants.brand` / `restaurants.theme` are JSONB; parsers normalize unknown JSON to defaults. Keep this module free of Supabase and request APIs.

## Color mode (DIG-16)

[`color-mode.ts`](./color-mode.ts) — pure helpers for owner-panel light/dark/system preference (`parseColorMode`, `isDarkMode`, cookie name). Used by `Root` + `ColorModeToggle`; no I/O.

## Slugs (Phase 2)

[`slug.ts`](./slug.ts) — `slugify` / `slugFromName` for owner creates (menus, categories, tags, products). Uniqueness is enforced per restaurant in Postgres.

## Category / tag icons (DIG-19)

[`category-icons.ts`](./category-icons.ts) — curated Tabler outline ids + `isCategoryIconId` + tag name suggestions. Pure data for owner pickers.

## Menu icons / templates (DIG-18)

| Module | Role |
|--------|------|
| [`menu-icons.ts`](./menu-icons.ts) | Curated Tabler ids + `isMenuIconId` + name suggestions for cartas |
| [`menu-templates.ts`](./menu-templates.ts) | Minimal registry (`classic` only through CP3) |
