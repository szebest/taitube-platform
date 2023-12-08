import { baseApi } from "src/base-api";

import { PaginatedQueryParams, PaginatedResponse } from "src/models";
import { User, Video } from "src/modules/shared/models";
import { VideoComment, AddVideoComment } from "../models";

export const videoApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    videoDetails: builder.query<Video, number>({
      query: (id) => `/videos/${id}`
    }),
		getVideoComments: builder.query<PaginatedResponse<VideoComment>, { videoId: number, queryParams?: PaginatedQueryParams }>({
      keepUnusedDataFor: 0,
      query: ({ videoId, queryParams }) => {
				const params = new URLSearchParams(queryParams as never);

				return {
					url: `/videos/${videoId}/comments?${params}`,
				}
			},
      serializeQueryArgs: ({ endpointName, queryArgs: { videoId } }) => {
        return endpointName + videoId;
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
        return (currentArg!.queryParams?.pageNumber ?? 0) > (previousArg?.queryParams?.pageNumber ?? 0) || 
					currentArg?.queryParams?.pageSize !== previousArg?.queryParams?.pageSize || 
					currentArg?.videoId !== previousArg?.videoId;
      }
    }),
    addVideoComment: builder.mutation<VideoComment, { videoId: number, body: AddVideoComment, user?: User }>({
			query: ({ videoId, body }) => ({
				url: `/videos/${videoId}/comments`,
				method: 'POST',
				body
			}),
      async onQueryStarted({ videoId, body: { data }, user }, { dispatch, queryFulfilled }) {
				const { fullName, id: userId } = user ?? { fullName: '', id: '' }

				const item = {
					userId,
					videoId,
					data,
					fullName,
					createdAt: (new Date()).toString(),
					loading: true
				};

        const patchResult = dispatch(
          videoApiSlice.util.updateQueryData('getVideoComments', { videoId }, draft => {
            draft.data.unshift(item);
          })
        )
        try {
          await queryFulfilled
        } catch {
          patchResult.undo()
        }
				finally {
					dispatch(videoApiSlice.util.updateQueryData('getVideoComments', { videoId }, draft => {
						const newData = draft.data.map(x => {
							if (x.createdAt === item.createdAt && item.loading) {
								return { ...x, loading: false }
							}

							return x;
						});

						draft.data = newData;
          }));
				}
      }
		})
  })
});

export const {
  useVideoDetailsQuery,
	useGetVideoCommentsQuery,
	useAddVideoCommentMutation
} = videoApiSlice;