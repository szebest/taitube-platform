import { useCallback, useState } from "react";

export type KeysetPage = {
	nextCursor: string | null;
};

export type KeysetArgs = {
	cursor?: string | undefined;
	limit?: number | undefined;
};

export type KeysetQueryHook<TPage extends KeysetPage, TArgs extends KeysetArgs> = (args: TArgs) => {
	data?: TPage | undefined;
	currentData?: TPage | undefined;
	isFetching: boolean;
	isLoading: boolean;
	isError: boolean;
	refetch: () => unknown;
};

/**
 * Advances a keyset feed by asking for the cursor the previous page returned.
 * The query hook caches every page under one key, so `data` is the whole list.
 */
export const useInfiniteScroll = <TPage extends KeysetPage, TArgs extends KeysetArgs>(
	useKeysetQuery: KeysetQueryHook<TPage, TArgs>,
	initialQuery: TArgs
) => {
	const [query, setQuery] = useState<TArgs>(initialQuery);
	const queryData = useKeysetQuery(query);

	const { isFetching, data } = queryData;
	const nextCursor = data?.nextCursor ?? null;

	const loadMore = useCallback(() => {
		if (isFetching || !nextCursor) return;

		setQuery(prev => ({ ...prev, cursor: nextCursor }));
	}, [isFetching, nextCursor]);

	return { loadMore, queryData, query, setQuery };
};
