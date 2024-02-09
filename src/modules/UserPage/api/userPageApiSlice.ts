import { baseApi } from "src/base-api";

import { PaginatedResponse } from "src/models";
import { Video } from "src/modules/shared/models";
import { UserDetails, UserVideosRequestParams } from "../models";

let previousPageNumber = 0;

export const userPageApiSlice = baseApi.injectEndpoints({
	endpoints: (builder) => ({
		getUserDetails: builder.query<UserDetails, number>({
			keepUnusedDataFor: 0,
			query: (userId) => `/account/profile/details/${userId}`,
		}),
		getUserVideos: builder.query<PaginatedResponse<Video>, UserVideosRequestParams>({
			keepUnusedDataFor: 300,
			providesTags: ['VIDEOS'],
			query: (requestParams) => {
				const { userId, ...queryParams } = requestParams;
				const queryParamsCopied = { ...queryParams };

				if (queryParamsCopied.pageNumber === previousPageNumber) queryParamsCopied.pageNumber = 0;

				previousPageNumber = queryParamsCopied.pageNumber;

				const params = new URLSearchParams(JSON.parse(JSON.stringify(queryParamsCopied)) as never);

				return {
					url: `/videos/user/${userId}?${params}`,
				}
			},
			serializeQueryArgs: ({ endpointName, queryArgs }) => {
				return endpointName + queryArgs.userId;
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
				return currentArg!.pageNumber > (previousArg?.pageNumber ?? 0) ||
					currentArg?.pageSize !== previousArg?.pageSize;
			}
		})
	})
});

export const {
	useGetUserVideosQuery,
	useGetUserDetailsQuery
} = userPageApiSlice;