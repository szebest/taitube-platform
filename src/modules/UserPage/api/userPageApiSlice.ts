import { baseApi } from "src/base-api";

import { PaginatedResponse } from "src/models";
import { Video } from "src/modules/shared/models";
import { UserDetails, UserVideosRequestParams } from "../models";

export const userPageApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUserDetails: builder.query<UserDetails, number>({
      keepUnusedDataFor: 0,
      query: (userId) => `/account/profile/details/${userId}`,
    }),
    getUserVideos: builder.query<PaginatedResponse<Video>, UserVideosRequestParams>({
      keepUnusedDataFor: 60,
      query: (requestParams) => {
				const { userId, ...queryParams } = requestParams;
				const params = new URLSearchParams(JSON.parse(JSON.stringify(queryParams)) as never);

				return {
					url: `/videos/user/${userId}?${params}`,
				}
			},
      serializeQueryArgs: ({ endpointName, queryArgs }) => {
        return endpointName + queryArgs.userId;
      },
      merge: (currentCache, newItems) => {
        const { data, ...rest } = newItems;

        currentCache.data.push(...newItems.data);

        currentCache = {
          ...currentCache,
          ...rest
        }
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