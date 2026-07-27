# Storage — bucket `media` (DIG-5)

## Concepts

A **bucket** is a named file container in Supabase Storage. DigiMenu uses one public bucket:

| Bucket | Public | Purpose |
|--------|--------|---------|
| `media` | yes | Restaurant logos + product/category images |

- **Public** means anyone with the object URL can **download** it (good for `/m` menus).
- Uploads, updates, and deletes still require RLS. Phase 0 stub: any **authenticated** user may write to `media`. Phase 1 will restrict writes to owners of `{restaurante_id}` via `owner_restaurantes`.

## Path convention

```text
{restaurante_id}/logos/{filename}
{restaurante_id}/productos/{filename}
{restaurante_id}/categorias/{filename}
```

Example: `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/logos/light.webp`

Limits (bucket): max **5 MiB**; MIME `image/jpeg`, `image/png`, `image/webp`, `image/gif`.

## Public URL

```text
{PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/{path}
```

For this project:

```text
https://rytjzpqmyysftxdwcnhe.supabase.co/storage/v1/object/public/media/{restaurante_id}/logos/foo.webp
```

Store that full URL (or path + build URL in app) on the DB row when uploads land in Phase 2.

## Migration

Source of truth: [`supabase/migrations/20260727000000_storage_media_bucket.sql`](../supabase/migrations/20260727000000_storage_media_bucket.sql)

Creates/updates the bucket and policies:

- `media_authenticated_insert`
- `media_authenticated_update`
- `media_authenticated_delete`

## Smoke test (Dashboard)

1. Open [Storage](https://supabase.com/dashboard/project/rytjzpqmyysftxdwcnhe/storage/buckets) for `digimenu-db-v2`.
2. Open bucket **media**.
3. Create folder with a fake UUID (stand-in `restaurante_id`), then `logos`, upload a small `.webp`/`.png`.
4. Open the object → copy public URL → confirm it loads in a private window.

No owner UI upload in DIG-5; app helpers come later.
