import { UseQuery } from "@reduxjs/toolkit/dist/query/react/buildHooks";
import { BaseQueryFn, FetchArgs, FetchBaseQueryError, FetchBaseQueryMeta, QueryDefinition } from "@reduxjs/toolkit/query";
import { useCallback, useEffect, useState } from "react";

import { PaginatedQueryParams, PaginatedResponse } from "src/models";

export type InfiniteDataType<T, U> = 
	UseQuery<QueryDefinition<U, BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError, {}, FetchBaseQueryMeta>, never, PaginatedResponse<T>, never>>;

export const useInfiniteScroll = <T, U extends PaginatedQueryParams>(useInfiniteData: InfiniteDataType<T, U>, initialQuery: U) => {
	const [blockInit, setBlockInit] = useState(true);
	const [query, setQuery] = useState<U>(initialQuery);
	const queryData = useInfiniteData(query);

	const { isFetching, currentData } = queryData;

	const loadMore = useCallback(() => {
		if (isFetching) return;

		setQuery(prev => ({ ...prev, pageNumber: (currentData?.pageNumber ?? 0) + 1 }));
	}, [isFetching, currentData]);

	useEffect(() => {
		if (isFetching) return;

		if (blockInit) {
			setBlockInit(true);
			return;
		}

		queryData.refetch();
	}, [query]);

	return { loadMore, queryData, query, setQuery };
};