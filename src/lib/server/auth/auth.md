# `lib/server/auth`

Session helpers for DigiMenu owner SSR.

## Entrypoints

| Export | Role |
|--------|------|
| `createSupabaseServerClient` | `@supabase/ssr` client with request cookies |
| `getUser` | Current Supabase Auth user or `null` |
| `requireUser` | User or redirect to `/app/login` |
| `getSupabasePublicEnv` | `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` |

## Rules

- HTTP paths use the **anon** key + user session only (RLS applies later).
- **Never** use `SUPABASE_SERVICE_ROLE_KEY` here or in Actions serving browsers.
- Magic link: Action `auth.sendMagicLink` → email → `/app/auth/callback` → `exchangeCodeForSession`.
- `digimenu_owner` cookie + `owner_restaurantes` mapping: **DIG-13** (not this module yet).

## Orchestration

```text
middleware → refresh session cookies via createSupabaseServerClient + getUser
pages /app/* → requireUser (except login + callback)
actions.auth.* → createSupabaseServerClient → signInWithOtp / signOut
```
