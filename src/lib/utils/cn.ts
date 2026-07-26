import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names (Starwind / shared UI helper). */
export function cn(...inputs: Array<string | false | null | undefined>): string {
	return twMerge(inputs.filter(Boolean).join(" "));
}
