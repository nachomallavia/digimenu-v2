# `lib/client/owner`

Browser-only owner UI state (pending edits, toasts) via Nanostores.

Must not import `lib/server/*`. Mutations go through Astro Actions.

## Entrypoints

| Export | Role |
|--------|------|
| `bindLogoPreviews` / `bindBrandForm` | `/app/info` logo file previews + dynamic brand color/font rows (DIG-17) |
