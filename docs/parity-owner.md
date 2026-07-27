# CP2 — Owner parity checklist (DIG-22)

Compared **DigiMenu v2** (`main`) vs sibling production reference [`../digimenu`](../../digimenu) owner dashboard ([docs/owner-dashboard.md](../../digimenu/docs/owner-dashboard.md)).

Date: **2026-07-27**. Scope: `/app` owner surface only (public `/m` → Phase 3 / DIG-29).

## Verdict

| Gate | Decision |
|------|----------|
| Owner parity for Phase 2 | **PASS** |
| Go/no-go Phase 3 | **GO** — owner CRUD IA is enough to unblock public menu work |

Follow-up polish (Resumen counts, legacy redirects, prefetch) closed after DIG-22.

## Phase 2 tickets

| Issue | Status |
|-------|--------|
| DIG-16 shell + sidebar | Done |
| DIG-17 restaurant info + brand/theme + logos | Done |
| DIG-18 menus + `menu_products` assign | Done |
| DIG-19 categories + tags | Done |
| DIG-20 products list/batch/detail/images | Done |
| DIG-21 products CSV import/export | Done |

## Checklist (feature)

| Feature | Production (v1) | DigiMenu v2 | Result |
|---------|-----------------|-------------|--------|
| Magic link login `/app/login` | Yes | Yes | **PASS** |
| `/app/pending` unmapped user | Yes | Yes | **PASS** |
| `requireOwner` gate on `/app` | Cookie + mapping | Session + `owner_restaurants` (cookie deferred) | **PASS** (intentional) |
| Dashboard shell + sidebar IA | Resumen, Restaurant, Menús, Productos, Categorías, Etiquetas | Same labels/routes | **PASS** |
| No View Transitions on `/app` | Disabled | Disabled | **PASS** |
| Resumen SSR counts | Productos + categorías cards | Productos, categorías, menús, etiquetas + Gestionar/Crear | **PASS** (exceeds v1) |
| `/app/info` datos + brand/theme | Yes | Yes (Actions + Storage logos) | **PASS** |
| Logos light/dark upload | EmDash media | Supabase Storage `media` | **PASS** |
| Menús list / create / detail | Yes | Yes | **PASS** |
| Menu product assign (junction UX) | Yes (`productos_ids` anti-pattern under EmDash) | Yes via `menu_products` | **PASS** (better) |
| Categorías CRUD + icon/cover/orden | Yes | Yes | **PASS** |
| Etiquetas CRUD | Yes | Yes | **PASS** |
| Productos list inline + batch save | Yes (nanostores) | Yes (`lib/client/owner` + `batchUpdate`) | **PASS** |
| Producto new / detail / delete | Yes | Yes | **PASS** |
| Product image upload | EmDash media | Storage | **PASS** |
| Product ↔ tags / multi-menu on detail | Yes | Yes (`setTags` / `setMenus`) | **PASS** |
| Productos CSV export/import + signed ids | ULID + HMAC | UUID + HMAC (`id_sig`) | **PASS** |
| Mutations via one write path | EmDash runtime | Astro Actions → `lib/server/*` | **PASS** |
| No EmDash admin / draft-publish | Required in v1 stack | Gone | **PASS** (goal) |
| Legacy redirects (`/app/menu`, `/app/estilos`, tab URLs) | Yes | Yes | **PASS** |
| Prefetch panel routes on Resumen | Yes | Yes (idle prefetch) | **PASS** |
| `writesEnabled` / PAT gate | EmDash token | N/A (RLS + session) | **N/A** (v2 model) |

## Gaps closed (post DIG-22 polish)

1. **Resumen counts** — four SSR cards (productos, categorías, menús, etiquetas) with Gestionar + Crear nuevo.
2. **Legacy redirects** — `/app/menu`, `/app/estilos`, `/app/menus/lista`, `/app/menus/estilo`, `/app/menus/[id]/estilo`, `/app/menus/[id]/productos`.
3. **Resumen prefetch** — idle `astro:prefetch` of panel routes.

## Explicit out of CP2

- Public `/m/*` Classic parity → Phase 3 (DIG-23+)
- Self-serve onboarding / OAuth / multi-template → Phase 4
- Full EmDash CSV dump restore → plan only (DIG-14)
- `digimenu_owner` cookie → deferred

## Smoke notes

- Auth + tenancy verified earlier (DIG-13); owner linked via `owner_restaurants`.
- Seed `seed-demo` available for empty catalogs (DIG-14).
- Visual/UX smoke against production should still be done manually on Vercel `/app` before calling Phase 3 “done”; this checklist is **feature/route parity**, not pixel QA.
