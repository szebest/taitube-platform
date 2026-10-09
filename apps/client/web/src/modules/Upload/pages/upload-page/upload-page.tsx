import { useUploadVideo } from '#app/features/upload/hooks/use-upload-video';

import { VideoForm, type UploadFormValues } from '#app/modules/Upload/components';

export function UploadPage() {
	const upload = useUploadVideo();

	const submit = ({ file: [file], title, visibility }: UploadFormValues) => {
		if (!file) return;

		upload.mutate({
			file,
			filename: file.name,
			sizeBytes: file.size,
			contentType: file.type,
			title,
			visibility,
		});
	}

	return (
		<VideoForm
			submit={submit}
			isError={upload.isError}
			isSuccess={upload.isSuccess}
			progress={upload.progress}
			reset={upload.reset}
			data={upload.data}
		/>
	)
}
