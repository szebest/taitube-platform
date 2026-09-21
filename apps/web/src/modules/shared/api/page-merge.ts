export type CursorPage<T> = {
	items: T[];
	nextCursor: string | null;
};

/**
 * Keyset pages arrive one cursor at a time; RTK Query caches them under a single
 * key, so each response is appended rather than replacing what is on screen.
 */
export function appendPage<T extends CursorPage<unknown>>(cache: T, incoming: T): void {
	cache.items.push(...incoming.items);
	cache.nextCursor = incoming.nextCursor;

	if ('total' in incoming) {
		(cache as T & { total: number }).total = (incoming as T & { total: number }).total;
	}
}
