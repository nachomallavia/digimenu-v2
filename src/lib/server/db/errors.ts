import type { PostgrestError } from "@supabase/supabase-js";

export class DbError extends Error {
	readonly code: string | undefined;

	constructor(message: string, code?: string) {
		super(message);
		this.name = "DbError";
		this.code = code;
	}

	static fromPostgrest(error: PostgrestError, fallback = "Database error"): DbError {
		return new DbError(error.message || fallback, error.code);
	}
}

export function throwOnError(error: PostgrestError | null, fallback?: string): void {
	if (error) {
		throw DbError.fromPostgrest(error, fallback);
	}
}
