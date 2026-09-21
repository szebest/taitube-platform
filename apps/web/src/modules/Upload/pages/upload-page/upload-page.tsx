import { useUploadVideoMutation } from '../../api';

import { UploadFormModel } from '../../models';

import { VideoForm } from '../../components';

export function UploadPage() {
	const [upload, state] = useUploadVideoMutation();

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

export default UploadPage;
