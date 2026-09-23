import { ignore, tryCatch, unwrapOr } from '@vp/result';

import { AUTH_TOKEN_LOCAL_STORAGE_KEY } from 'src/config';

/**
 * This API authenticates with a bearer JWT; there is no browser sign-in flow to
 * mint one. Local development tokens come from `pnpm dev-token`.
 */
export function readAuthToken(): string | null {
	const stored = tryCatch(
		() => window.localStorage.getItem(AUTH_TOKEN_LOCAL_STORAGE_KEY),
		(cause) => cause
	);
	return unwrapOr(stored, null);
}

export function clearAuthToken(): void {
	ignore(
		tryCatch(() => window.localStorage.removeItem(AUTH_TOKEN_LOCAL_STORAGE_KEY), (cause) => cause),
		'a blocked storage partition leaves the caller unauthenticated, which is the safe end state'
	);
}
