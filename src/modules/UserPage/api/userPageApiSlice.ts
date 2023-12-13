import { baseApi } from "src/base-api";

import { PaginatedResponse } from "src/models";
import { Video } from "src/modules/shared/models";
import { UserDetails, UserVideosRequestParams } from "../models";

const userDetails: UserDetails = {
  userFullName: 'szebest',
  isSubscribed: false,
  subscriptions: 0
}

export const userPageApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUserDetails: builder.query<UserDetails, number | undefined>({
      keepUnusedDataFor: 0,
      //query: (userId) => `/user/${userId}`,
      queryFn: () => ({ data: userDetails })
    }),
    getUserVideos: builder.query<PaginatedResponse<Video>, UserVideosRequestParams>({
      keepUnusedDataFor: 60,
      query: (queryParams) => {
				const params = new URLSearchParams(JSON.parse(JSON.stringify(queryParams)) as never);

				return {
					url: `/videos?${params}`,
				}
			},
      // queryFn: async (queryParams, _api, _extraOptions, baseQuery) => {
      //   if (isNaN(queryParams.userId)) return { error: { status: 400, data: null } };

      //   const params = new URLSearchParams(queryParams as never);

      //   const result = await baseQuery(`/videos?${params}`);

      //   return { data: result.data as PaginatedResponse<Video> };
      // },
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
          currentArg?.pageSize !== previousArg?.pageSize ||
          currentArg?.userId !== previousArg?.userId;
      }
    })
  })
});

export const {
  useGetUserVideosQuery,
  useGetUserDetailsQuery
} = userPageApiSlice;