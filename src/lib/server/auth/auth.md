# `lib/server/auth`

Session helpers for DigiMenu owner SSR.

## Entrypoints

| Export | Role |
|--------|------|
| `createSupabaseServerClient` | `@supabase/ssr` client with request cookies |
| `getUser` | Current Supabase Auth user or `null` |
| `requireUser` | User or redirect to `/app/login` |
| `requireOwner` | User + restaurant from `owner_restaurants`, or redirect `/app/login` / `/app/pending` |
| `getSupabasePublicEnv` | `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` |

## Rules

- HTTP paths use the **anon** key + user session only (RLS applies — [docs/rls.md](../../../../docs/rls.md)).
- **Never** use `SUPABASE_SERVICE_ROLE_KEY` here or in Actions serving browsers.
- Magic link: Action `auth.sendMagicLink` → email → `/app/auth/callback` → `exchangeCodeForSession`.
- **No `digimenu_owner` cookie in Alpha** — deferred until multi-restaurant switcher or measured need. Tenancy = Supabase session + `listRestaurantsForUser` on each `requireOwner`.

## Orchestration

```text
middleware → refresh session + locals.user / locals.supabase
/app/* (except login, callback, pending) → requireOwner
/app/pending → Auth user without owner_restaurants row
actions.auth.* → signInWithOtp / signOut
```

Active restaurant = first row from `listRestaurantsForUser` (ordered by `name`). Switcher later.

## Link Auth user → restaurant (ops / smoke)

Run as privileged role (Dashboard SQL / service role). Replace placeholders:

```sql
-- 1) Restaurant (skip if you already have one)
insert into public.restaurants (id, slug, name, active)
values (
  gen_random_uuid(),
  'demo',
  'Demo Restaurant',
  true
)
returning id;

-- 2) Link (use Auth user UUID from Dashboard → Authentication → Users)
insert into public.owner_restaurants (user_id, restaurant_id)
values (
  '<AUTH_USER_UUID>',
  '<RESTAURANT_UUID>'
);
```

Then magic-link login → `/app` shows the restaurant name. Without the link → `/app/pending`.
