import { AUTH_TOKEN_LOCAL_STORAGE_KEY } from 'src/config';

/**
 * This API authenticates with a bearer JWT; there is no browser sign-in flow to
 * mint one. Local development tokens come from `pnpm dev-token`.
 */
export function readAuthToken(): string | null {
	try {
		return window.localStorage.getItem(AUTH_TOKEN_LOCAL_STORAGE_KEY);
	} catch {
		return null;
	}
}

export function clearAuthToken(): void {
	try {
		window.localStorage.removeItem(AUTH_TOKEN_LOCAL_STORAGE_KEY);
	} catch {
		// A blocked storage partition leaves the caller unauthenticated, which is the safe end state.
	}
}
