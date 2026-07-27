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

## DIG-18 assign UX (simplified vs legacy Lista)

Parity goal: checkbox membership with live save. Simplified vs EmDash Lista:

- Native category `<select>` instead of Starwind multi-checkbox dropdown
- No page-size pager (full filtered list)
- Saves via Astro Action `menus.setProducts` → `setMenuProducts` (not JSON POST on the page)
- Theme/estilo tab removed — marca/tema lives on `/app/info` (DIG-17)
