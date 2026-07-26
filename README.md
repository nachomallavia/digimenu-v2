# DigiMenu v2

Greenfield DigiMenu — **Astro + Starwind + Tailwind + Supabase + Vercel**. No EmDash.

## Start here

Structure, module map, and coding rules live in **[AGENTS.md](./AGENTS.md)**.  
That file is the source of truth for how we diagram the project and organize files. Do not invent folder layouts until it is agreed (Linear **DIG-2**).

## Stack (target)

| Layer | Choice |
|-------|--------|
| App | Astro SSR + Starwind + Tailwind |
| Auth / DB / Storage | Supabase |
| Host | Vercel (Node) |

## Roadmap

Tracked in Linear: [DigiMenu v2](https://linear.app/cheij-lab/project/digimenu-v2-0a84b080f200) (team Digimenu).

1. **Alpha** — this repo + collaborative `AGENTS.md` (current)
2. **Phase 0** — bootstrap (auth, storage, deploy)
3. **Phase 1** — domain + RLS
4. **Phase 2** — owner `/app` parity
5. **Phase 3** — public `/m/*` parity
6. **Phase 4** — onboarding, OAuth, domains, templates

## Legacy reference

EmDash-era DigiMenu lives in the sibling repo `digimenu`. CSV backup of production content: `digimenu/backups/emdash-2026-07-26/`.
