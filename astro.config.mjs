// @ts-check
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import { cacheVercel } from "@astrojs/vercel/cache";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
	output: "server",
	adapter: vercel(),
	cache: {
		provider: cacheVercel(),
	},
	routeRules: {
		"/m/[restaurant]": { maxAge: 60, swr: 3600 },
		"/m/[restaurant]/[menu]": { maxAge: 60, swr: 3600 },
	},
	prefetch: {
		prefetchAll: false,
		defaultStrategy: "hover",
	},
	vite: {
		plugins: [tailwindcss()],
	},
});
