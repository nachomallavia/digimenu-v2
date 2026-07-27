import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { createSupabaseServerClient } from "@/lib/server/auth";

function authCallbackUrl(request: Request): string {
	return new URL("/app/auth/callback", request.url).href;
}

export const server = {
	auth: {
		sendMagicLink: defineAction({
			accept: "form",
			input: z.object({
				email: z.string().trim().email(),
			}),
			handler: async ({ email }, context) => {
				const supabase = createSupabaseServerClient(context.request, context.cookies);
				const { error } = await supabase.auth.signInWithOtp({
					email: email.toLowerCase(),
					options: {
						emailRedirectTo: authCallbackUrl(context.request),
					},
				});

				if (error) {
					console.error("[auth.sendMagicLink]", error.message);
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "No se pudo enviar el enlace. Probá de nuevo.",
					});
				}

				return { sent: true as const };
			},
		}),

		signOut: defineAction({
			accept: "form",
			handler: async (_input, context) => {
				const supabase = createSupabaseServerClient(context.request, context.cookies);
				const { error } = await supabase.auth.signOut();
				if (error) {
					console.error("[auth.signOut]", error.message);
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "No se pudo cerrar sesión.",
					});
				}
				return { ok: true as const };
			},
		}),
	},
};
