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
| `batchUpdateProducts` | Inline list patches (name / price / category_id) with per-row failure reporting (DIG-20) |
| `exportProductsCsv` / `previewProductsCsvImport` / `importProductsCsv` | Product CSV roundtrip (DIG-21): ES headers, HMAC `id_sig`, category/tag near-match resolutions, image fetch→Storage |

## Rules

- Use request-bound SSR Supabase client (RLS applies). Never service role.
- Storage paths and limits: [docs/storage.md](../../../../docs/storage.md).
- CSV signing secret: `DIGIMENU_ID_HASH_SECRET` (required for export/import).
- Owner product CSV ≠ EmDash dump restore ([docs/csv-import-plan.md](../../../../docs/csv-import-plan.md)).
