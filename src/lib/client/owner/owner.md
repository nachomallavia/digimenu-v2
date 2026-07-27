# `lib/client/owner`

Browser-only owner UI state (pending edits, toasts) via Nanostores / DOM helpers.

Must not import `lib/server/*`. Mutations go through Astro Actions.

## Entrypoints

| Export | Role |
|--------|------|
| `initCategoryCards` | Dirty-state + cover preview for category cards (DIG-19) |
| `bindIconPreview` | Sync icon preview on Starwind Select change |
| `bindSuggestChips` | Fill inputs from `[data-suggest]` chips |
