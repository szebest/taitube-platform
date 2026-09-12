import { baseApi } from "src/base-api";
import { PaginatedQueryParams, PaginatedResponse } from "src/models";
import { Video } from "src/modules/shared/models";

let previousPageNumber = 0;

export const subscriptionVideosApiSlice = baseApi.injectEndpoints({
	endpoints: (builder) => ({
		subscriptionVideos: builder.query<PaginatedResponse<Video>, PaginatedQueryParams>({
			keepUnusedDataFor: 300,
			providesTags: ['VIDEOS', 'SUBSCRIPTION-VIDEOS'],
			query: (queryParams) => {
				const queryParamsCopied = { ...queryParams };

				if (queryParamsCopied.pageNumber === previousPageNumber) queryParamsCopied.pageNumber = 0;

				previousPageNumber = queryParamsCopied.pageNumber;

				const params = new URLSearchParams(JSON.parse(JSON.stringify(queryParamsCopied)) as never);

				return {
					url: `/videos/subscriptions?${params}`,
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
				return currentArg!.pageNumber > (previousArg?.pageNumber ?? 0) || currentArg?.pageSize !== previousArg?.pageSize;
			}
		})
	})
});

export const {
	useSubscriptionVideosQuery
} = subscriptionVideosApiSlice;