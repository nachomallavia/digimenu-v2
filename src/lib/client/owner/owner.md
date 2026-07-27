# `lib/client/owner`

Browser-only owner UI state (pending edits, toasts) via Nanostores / DOM helpers.

Must not import `lib/server/*`. Mutations go through Astro Actions.

## Entrypoints

| Export | Role |
|--------|------|
| `bindLogoPreviews` / `bindBrandForm` | `/app/info` logo file previews + dynamic brand color/font rows (DIG-17) |
| `initCategoryCards` | Dirty-state + cover preview for category cards (DIG-19) |
| `bindIconPreview` | Sync icon preview on Starwind Select change |
| `bindSuggestChips` | Fill inputs from `[data-suggest]` chips |
| `bootMenuProducts` | Menu product assign: search/category filter, checkboxes, debounced `menus.setProducts` (DIG-18) |
| `bootProductosEditor` | Products list: Nanostores pending map, search/category filter, batch `products.batchUpdate`, row image/delete, CSV import/export (DIG-20/21) |
| `bindProductsCsv` | CSV download / preview dialog (categories + tags) / import via Actions (DIG-21) |

## DIG-18 assign UX (simplified vs legacy Lista)

Parity goal: checkbox membership with live save. Simplified vs EmDash Lista:

- Native category `<select>` instead of Starwind multi-checkbox dropdown
- No page-size pager (full filtered list)
- Saves via Astro Action `menus.setProducts` → `setMenuProducts` (not JSON POST on the page)
- Theme/estilo tab removed — marca/tema lives on `/app/info` (DIG-17)

## DIG-20 products list (simplified vs legacy)

- Nanostores pending map for name / price / category_id inline edits → `products.batchUpdate`
- Search + native category filter (no tag multi-filter or pager)
- Row image upload via `products.uploadImage`; delete via `products.deleteJson`
- CSV export/import via `products.exportCsv` / `previewCsvImport` / `importCsv` (DIG-21)
- Detail `/app/productos/[id]` uses form Actions for full fields + tags + menus + image
