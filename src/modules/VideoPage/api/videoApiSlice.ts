import { baseApi } from "src/base-api";

import { PaginatedQueryParams, PaginatedResponse } from "src/models";
import { User } from "src/modules/shared/models";
import { VideoComment, AddVideoComment, VideoDetails } from "../models";

const video: VideoDetails = {
	userFullName: "szebest",
	userId: 1,
	likes: 0,
	dislikes: 0,
	subscriptions: 0,
	isSubscribed: false,
	isLiked: false,
	isDisliked: false,
	id: 0,
	title: "Mockowy tytuł filmiku",
	description: "Mockowy opis filmiku",
	category: 0,
	createdAt: (new Date()).toString(),
	views: 0,
	thumbnailSrc: "a"
}

export const videoApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    videoDetails: builder.query<VideoDetails, { videoId: number }>({
			keepUnusedDataFor: 0,
      //query: ({ videoId }) => `/videos/${videoId}`,
			queryFn: () => ({ data: video })
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
				const { fullName, id: userId } = user ?? { fullName: '', id: -1 }

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
		}),
		likeVideo: builder.mutation<void, { videoId: number, value: number }>({
			query: ({ videoId, value }) => ({
				url: `/videos/${videoId}/like`,
				method: 'POST',
				body: {
					value
				}
			}),
			// queryFn: () => ({data: void 0}),
      async onQueryStarted({ videoId, value }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          videoApiSlice.util.updateQueryData('videoDetails', { videoId }, draft => {
						if (value >= 0) {
							//reset dislikes
							draft.dislikes -= +draft.isDisliked;
							draft.isDisliked = false;

							//set likes
							draft.isLiked = true;
							draft.likes += 1;
						}
						else if (value <= 0) {
							//reset likes
							draft.likes -= +draft.isLiked;
							draft.isLiked = false;

							//set dislikes
							draft.isDisliked = true;
							draft.dislikes += 1;
						}
          })
        )
        try {
          await queryFulfilled
        } catch {
          //patchResult.undo()
        }
      }
		}),
		deleteLikeFromVideo: builder.mutation<void, { videoId: number, isLike: boolean }>({
			query: ({ videoId }) => ({
				url: `/videos/${videoId}/like`,
				method: 'DELETE'
			}),
			// queryFn: () => ({data: void 0}),
      async onQueryStarted({ videoId, isLike }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          videoApiSlice.util.updateQueryData('videoDetails', { videoId }, draft => {
						if (isLike) {
							draft.likes -= +draft.isLiked;
							draft.isLiked = false;
						}
						else {
							draft.dislikes -= +draft.isDisliked;
							draft.isDisliked = false;
						}
          })
        )
        try {
          await queryFulfilled
        } catch {
          //patchResult.undo()
        }
      }
		}),
		shareVideo: builder.mutation<void, { videoId: number, userId: number }>({
			query: ({ videoId, userId }) => ({
				url: `/videos/${videoId}/share/${userId}`,
				method: 'POST'
			})
		})
  })
});

export const {
  useVideoDetailsQuery,
	useGetVideoCommentsQuery,
	useAddVideoCommentMutation,
	useLikeVideoMutation,
	useDeleteLikeFromVideoMutation,
	useShareVideoMutation
} = videoApiSlice;