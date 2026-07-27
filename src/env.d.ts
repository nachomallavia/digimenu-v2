/// <reference types="astro/client" />

declare namespace App {
	interface Locals {
		user: import("@supabase/supabase-js").User | null;
		supabase: import("@supabase/supabase-js").SupabaseClient;
	}
}

interface ImportMetaEnv {
	readonly PUBLIC_SUPABASE_URL: string;
	readonly PUBLIC_SUPABASE_ANON_KEY: string;
	readonly SUPABASE_SERVICE_ROLE_KEY?: string;
	readonly DIGIMENU_OWNER_COOKIE_SECRET?: string;
	/** HMAC secret for product CSV id signatures (DIG-21). */
	readonly DIGIMENU_ID_HASH_SECRET?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

/** Tabler SVG icons as Astro components (package subpath imports). */
declare module "@tabler/icons/outline/*.svg" {
	const Component: import("astro/types").SvgComponent;
	export default Component;
}

declare module "@tabler/icons/filled/*.svg" {
	const Component: import("astro/types").SvgComponent;
	export default Component;
}
