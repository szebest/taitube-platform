import { useSuspenseQuery } from '@tanstack/react-query';
import { useParams, useRouter } from '@tanstack/react-router';
import { ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';
import { toast } from 'react-toastify';

import { videoQueryOptions } from '#app/features/videos/api/video-queries';
import { useUpdateVideo } from '#app/features/videos/hooks/use-update-video';

import { EditVideoForm, type EditVideoFormValues } from '#app/modules/Upload/components';

function isVersionConflict(error: Error): boolean {
	return error instanceof ApiError && error.code === ErrorCodes.VERSION_CONFLICT;
}

export function EditPage() {
	const { videoId } = useParams({ from: '/_authed/upload/edit/$videoId' });
	const { data: video } = useSuspenseQuery(videoQueryOptions(videoId));
	const edit = useUpdateVideo(videoId);
	const router = useRouter();

	const submit = (form: EditVideoFormValues) => {
		edit.mutate({ ...form, version: video.version }, {
			onSuccess: () => {
				toast('Successfully edited the video');
				router.history.back();
			},
			onError: (error) => {
				if (isVersionConflict(error)) toast('The video changed while you were editing it');
			},
		});
	}

	return (
		<>
			<h3>Editing video: {video.title}</h3>
			<EditVideoForm
				submit={submit}
				defaultValues={{
					title: video.title ?? '',
					description: video.description ?? '',
					visibility: video.visibility,
				}}
				isError={edit.isError}
				isLoading={edit.isPending}
			/>
		</>
	)
}
