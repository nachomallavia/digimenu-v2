# `components/menu`

Public menu shell + plantillas. Templates consume **only** `MenuViewModel` from `lib/server/menu`.

## Flow

```text
pages/m/*  →  preparePublicMenuPage  →  layouts/Menu (CSS vars)
                                    →  PublicMenu (shell + template map)
                                         → templates/classic (or future plantilla)
                                         → lib/client/menu (DOM boot)
```

## Rules

1. **One feed:** plantillas receive `MenuViewModel` only — no DB, no regrouping.
2. **Shell owns chrome:** landing, nav, filters, History API, template selection (`PublicMenu.astro`).
3. **Registry split:** domain meta in `lib/domain/menu-templates.ts`; Astro map next to PublicMenu (`{ classic: Classic }`).
4. **DOM contract:** products/sections must emit `data-product`, `data-section`, `data-menu-ids`, `data-tag-ids`, `data-category-id`, `data-in-active-menu` so the shared client works.
5. **Layout owns brand:** templates consume CSS vars via Tailwind (`text-primary`, `border-border`, `rounded-lg`, etc.) — no hardcoded palettes and no scoped `<style>` blocks in plantillas.
6. **Styling:** Tailwind utilities only for shell + plantillas (same as `/app`). Exception: Starwind internals under `components/starwind/*`.

## Add a plantilla

1. Add meta to `MENU_TEMPLATES` in domain.
2. Create `templates/{id}/{Id}.astro` with `Props = MenuViewModel` + DOM contract + **Tailwind** (no new CSS dialect).
3. Register in PublicMenu: `templates = { classic: Classic, neon: Neon }`.
4. Persist id on `menus.template`.
