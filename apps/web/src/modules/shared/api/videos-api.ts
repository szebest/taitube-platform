import type { ListVideosQuery, UpdateVideoMetadata, Video, VideoListResponse } from "@vp/api-contracts";

import { apiClient, baseApi, runApiQuery } from "src/base-api";

import { appendPage } from "./page-merge";

const videosApi = baseApi.injectEndpoints({
	endpoints: (builder) => ({
		video: builder.query<Video, string>({
			providesTags: (_result, _error, id) => [{ type: 'VIDEO', id }],
			queryFn: (id) => runApiQuery(() => apiClient.videos.getVideo({ params: { id } })),
		}),
		myVideos: builder.query<VideoListResponse, ListVideosQuery>({
			providesTags: ['VIDEOS'],
			queryFn: (query) => runApiQuery(() => apiClient.videos.listVideos({ query })),
			serializeQueryArgs: ({ endpointName }) => endpointName,
			merge: appendPage,
			forceRefetch: ({ currentArg, previousArg }) => currentArg?.cursor !== previousArg?.cursor,
		}),
		updateVideo: builder.mutation<Video, UpdateVideoMetadata & { id: string }>({
			invalidatesTags: (_result, _error, { id }) => ['VIDEOS', { type: 'VIDEO', id }],
			queryFn: ({ id, ...body }) =>
				runApiQuery(() => apiClient.videos.updateVideo({ params: { id }, body })),
		}),
		deleteVideo: builder.mutation<{ videoId: string }, string>({
			invalidatesTags: ['VIDEOS'],
			queryFn: (id) => runApiQuery(() => apiClient.videos.deleteVideo({ params: { id } })),
		}),
	}),
});

export const {
	useVideoQuery,
	useMyVideosQuery,
	useUpdateVideoMutation,
	useDeleteVideoMutation,
} = videosApi;
