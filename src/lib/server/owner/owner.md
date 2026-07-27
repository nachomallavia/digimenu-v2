# `lib/server/owner`

Owner-only orchestration on top of `lib/server/db` + Supabase Storage.

Actions in `src/actions/` should call these modules rather than duplicating mutation logic.

## Entrypoints

| Export | Role |
|--------|------|
| `requireOwnerAction` | Gate for Astro Actions (throws `ActionError`) |
| `toActionError` | Map `DbError` → `ActionError` |
| `uploadMedia` / `removeMedia` / `removeMediaByPublicUrl` | Bucket `media` helpers (`{restaurant_id}/logos\|products\|categories/…`) |
| `publicMediaUrl` / `mediaPathFromPublicUrl` | URL ↔ path |
| `syncProductMenuMembership` | Product → menus sync over `menu_products` (DIG-20); DIG-18 assign uses `setMenuProducts` directly |

## Rules

- Use request-bound SSR Supabase client (RLS applies). Never service role.
- Storage paths and limits: [docs/storage.md](../../../../docs/storage.md).
- Batch product saves / CSV land here in DIG-20 / DIG-21.
