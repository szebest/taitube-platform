import { baseApi } from "src/base-api";
import { EditVideoFormModel, Video } from "../models";

export const videoApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
		videoInfo: builder.query<Video, number>({
			keepUnusedDataFor: 0,
			query: (videoId: number) => ({
				url: `/videos/${videoId}/info`,
				method: 'GET',
			})
		}),
    deleteVideo: builder.mutation<void, number>({
      query: (videoId: number) => ({
        url: `/videos/${videoId}`,
				method: 'DELETE',
      }),
			invalidatesTags: ['VIDEOS']
    }),
    editVideo: builder.mutation<void, EditVideoFormModel & { videoId: number }>({
      query: (data) => {
				const { videoId, ...body } = data;

				return {
					url: `/videos/${videoId}`,
					method: 'PATCH',
					body
				}
			},
			invalidatesTags: ['VIDEOS']
    })
  })
});

export const {
  useDeleteVideoMutation,
  useEditVideoMutation,
	useVideoInfoQuery
} = videoApiSlice;