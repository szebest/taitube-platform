import { apiClient, baseApi, runApiQuery } from "src/base-api";

import { type CompletedUpload, type UploadRequest, uploadVideo } from "./upload-video";

export const uploadsApi =baseApi.injectEndpoints({
	endpoints: (builder) => ({
		uploadProgress: builder.query<number, void>({
			queryFn: () => ({ data: 0 })
		}),
		uploadVideo: builder.mutation<CompletedUpload, UploadRequest>({
			invalidatesTags: ['VIDEOS'],
			queryFn: (request, api) =>
				runApiQuery(() =>
					uploadVideo(apiClient, request, (percent) => {
						api.dispatch(
							uploadsApi.util.updateQueryData('uploadProgress', undefined, () => percent)
						);
					})
				),
		}),
	}),
});
