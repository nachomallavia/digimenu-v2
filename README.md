# DigiMenu v2

Greenfield DigiMenu — **Astro SSR + Starwind + Tailwind + Supabase + Vercel**. No EmDash.

## Start here

Structure and coding rules: **[AGENTS.md](./AGENTS.md)** (source of truth).

Legacy reference (parity): `/Users/ignaciomallaviabarrena/Documents/programacion/digimenu` (`../digimenu`).

## Stack

| Layer | Choice |
|-------|--------|
| App | Astro SSR + Starwind + Tailwind v4 |
| Client state | Nanostores (`src/lib/client/*`) |
| Auth / DB / Storage | Supabase |
| Host | Vercel (`@astrojs/vercel`) |

## Scripts

```bash
npm install
npm run dev
npm run build
```

Copy `.env.example` → `.env` (and mirror the same keys in Vercel).

### Auth (DIG-3)

- Login: `/app/login` (magic link)
- Callback: `/app/auth/callback`
- Supabase Auth → URL configuration:
  - Site URL: `https://digimenu-v2.vercel.app` (or `http://localhost:4321` for local-only testing)
  - Redirect allow list: `https://digimenu-v2.vercel.app/**`, `http://localhost:4321/**`

### Storage (DIG-5)

- Public bucket `media` — logos / products / categories
- Paths + public URL format: **[docs/storage.md](./docs/storage.md)**
- SQL: `supabase/migrations/20260727000000_storage_media_bucket.sql`

### Domain schema (DIG-10)

- Tables + junctions (English): **[docs/schema.md](./docs/schema.md)**
- SQL: `supabase/migrations/20260727010000_domain_schema.sql`

### RLS (DIG-11)

- Ownership policies: **[docs/rls.md](./docs/rls.md)**
- SQL: `supabase/migrations/20260727020000_domain_rls.sql`

### EmDash backup (DIG-8)

- Inventory + row counts: **[docs/emdash-backup.md](./docs/emdash-backup.md)**
- Files live in sibling repo: `../digimenu/backups/emdash-2026-07-26/` (not copied here)
- Restore/import deferred (DIG-14 / Phase 2 CSV); ES headers map to EN columns in app

| Entity (CSV) | Rows |
|--------------|------|
| restaurantes | 1 |
| menus | 7 |
| menu_productos | 145 |
| categorias | 15 |
| tags | 3 |
| productos | 86 |
| pages | 1 (not ported) |
| owner_restaurants | stub — re-export needed |

## Roadmap

Tracked in Linear: [DigiMenu v2](https://linear.app/cheij-lab/project/digimenu-v2-0a84b080f200).

1. **Alpha** — repo + `AGENTS.md` ✅
2. **Phase 0** — bootstrap ✅ (DIG-3–7; DIG-8 backup docs)
3. **Phase 1** — domain + RLS (schema ✅ DIG-10, RLS ✅ DIG-11)
4. **Phase 2** — owner `/app` parity
5. **Phase 3** — public `/m/*` parity
6. **Phase 4** — onboarding, OAuth, domains, templates
