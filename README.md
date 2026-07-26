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

Copy `.env.example` → `.env` when wiring Supabase (DIG-3).

## Roadmap

Tracked in Linear: [DigiMenu v2](https://linear.app/cheij-lab/project/digimenu-v2-0a84b080f200).

1. **Alpha** — repo + `AGENTS.md` ✅
2. **Phase 0** — bootstrap (scaffold ✅ DIG-4, then auth, storage, deploy)
3. **Phase 1** — domain + RLS
4. **Phase 2** — owner `/app` parity
5. **Phase 3** — public `/m/*` parity
6. **Phase 4** — onboarding, OAuth, domains, templates
