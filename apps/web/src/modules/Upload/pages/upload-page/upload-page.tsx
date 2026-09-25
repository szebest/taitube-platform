import { uploadsApi } from '#app/modules/Upload/api';

import type { UploadFormModel } from '#app/modules/Upload/models';

import { VideoForm } from '#app/modules/Upload/components';

export function UploadPage() {
	const [upload, state] = uploadsApi.useUploadVideoMutation();

	const submit = (form: UploadFormModel) => {
		const [file] = form.file;

		upload({
			file,
			filename: file.name,
			sizeBytes: file.size,
			contentType: file.type,
			title: form.title,
			visibility: form.visibility,
		});
	}

	return (
		<VideoForm submit={submit} {...state} />
	)
}
