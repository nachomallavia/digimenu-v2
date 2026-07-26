# `lib/server/auth`

Session helpers, `requireOwner`, and the signed `digimenu_owner` cookie.

Wired in DIG-3 / DIG-13. Use SSR Supabase client only (RLS applies); never service role in request handlers.
