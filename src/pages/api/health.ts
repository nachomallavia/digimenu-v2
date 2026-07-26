import type { APIRoute } from "astro";

/** Lightweight health check for deploy smoke tests (DIG-6). */
export const GET: APIRoute = () =>
	Response.json({ ok: true, service: "digimenu-v2" });
