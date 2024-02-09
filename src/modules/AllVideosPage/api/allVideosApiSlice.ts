import { baseApi } from "src/base-api";

import { PaginatedResponse } from "src/models";
import { Video } from "src/modules/shared/models";
import { VideosQueryParams } from "../models";

let previousPageNumber = 0;

export const allVideosApiSlice = baseApi.injectEndpoints({
	endpoints: (builder) => ({
		allVideos: builder.query<PaginatedResponse<Video>, VideosQueryParams>({
			keepUnusedDataFor: 300,
			providesTags: ['VIDEOS'],
			query: (queryParams) => {
				const queryParamsCopied = { ...queryParams };

				if (queryParamsCopied.pageNumber === previousPageNumber) queryParamsCopied.pageNumber = 0;

				previousPageNumber = queryParamsCopied.pageNumber;

				const params = new URLSearchParams(JSON.parse(JSON.stringify(queryParamsCopied)) as never);

				return {
					url: `/videos?${params}`,
				}
			},
			serializeQueryArgs: ({ endpointName }) => {
				return endpointName;
			},
			merge: (currentCache, newItems) => {
				const { data, count } = newItems;

				if (previousPageNumber === 0) {
					currentCache.data.length = 0;
				}

				currentCache.data.push(...data);
				currentCache.pageNumber = previousPageNumber;
				currentCache.count = count;

				currentCache = { ...currentCache };
			},
			forceRefetch({ currentArg, previousArg }) {
				return currentArg?.categoryId !== previousArg?.categoryId ||
					currentArg?.searchText !== previousArg?.searchText || (currentArg?.pageNumber ?? 0) > previousPageNumber;
			},
		})
	})
});

export const {
	useAllVideosQuery
} = allVideosApiSlice;