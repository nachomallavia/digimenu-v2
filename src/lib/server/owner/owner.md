# `lib/server/owner`

Owner-only orchestration (CSV import/export, batch saves) on top of `lib/server/db`.

Actions in `src/actions/` should call these modules rather than duplicating mutation logic.
