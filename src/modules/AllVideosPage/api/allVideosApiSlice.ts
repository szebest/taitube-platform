import { baseApi } from "src/base-api";
import { PaginatedQueryParams, PaginatedResponse } from "src/models";
import { Video } from "src/modules/shared/models";

export const allVideosApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    allVideos: builder.query<PaginatedResponse<Video>, PaginatedQueryParams>({
      keepUnusedDataFor: 300,
      query: (queryParams) => {
				const params = new URLSearchParams(queryParams as never);

				return {
					url: `/videos?${params}`,
				}
			},
      serializeQueryArgs: ({ endpointName }) => {
        return endpointName;
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
        return currentArg!.pageNumber > (previousArg?.pageNumber ?? 0) || currentArg?.pageSize !== previousArg?.pageSize;
      }
    })
  })
});

export const {
  useAllVideosQuery
} = allVideosApiSlice;