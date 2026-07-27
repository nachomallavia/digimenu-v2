# `lib/domain`

Pure types and helpers (no I/O): brand/theme parsers, shared domain shapes.

## Types (DIG-12)

[`types.ts`](./types.ts) — row shapes for Postgres English schema (`Restaurant`, `Menu`, `Category`, `Tag`, `Product`, junctions, Insert/Update patches). See [docs/schema.md](../../../docs/schema.md).

Brand/theme JSON parsers land when owner brand UI needs them (DIG-17). Keep this module free of Supabase and request APIs.
