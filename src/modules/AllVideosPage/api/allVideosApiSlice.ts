import { baseApi } from "src/base-api";

import { PaginatedResponse } from "src/models";
import { Video } from "src/modules/shared/models";
import { VideosQueryParams } from "../models";

export const allVideosApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    allVideos: builder.query<PaginatedResponse<Video>, VideosQueryParams>({
      keepUnusedDataFor: 300,
      query: (queryParams) => {
				const params = new URLSearchParams(JSON.parse(JSON.stringify(queryParams)) as never);

				return {
					url: `/videos?${params}`,
				}
			},
      serializeQueryArgs: ({ endpointName, queryArgs: { searchText, categoryId } }) => {
        return `${endpointName} | ${categoryId} | ${searchText}`;
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
  useAllVideosQuery
} = allVideosApiSlice;