import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { useUpdateVideoMutation, useVideoQuery } from 'src/modules/shared/api';

import { EditVideoFormModel } from 'src/modules/shared/models';

import { EditVideoForm } from '../../components';
import { LoadingSpinner } from 'src/modules/shared/components';

export function EditPage() {
	const { videoId } = useParams();

	const { data: video, isFetching, isError } = useVideoQuery(videoId ?? '', { skip: !videoId });

	const [edit, state] = useUpdateVideoMutation();

	const navigate = useNavigate();

	useEffect(() => {
		if (!isError) return;

		toast("No video with given id exists!");
		navigate("/");
	}, [isError, navigate])

	if (!videoId) return <Navigate to="/" replace />

	const submit = async (form: EditVideoFormModel) => {
		if (!video) return;

		const response = await edit({ ...form, id: video.id, version: video.version });

		if ("data" in response) {
			toast(`Successfully edited the video`);

			navigate(-1);
			return;
		}

		if ("status" in response.error && response.error.status === 409) {
			toast(`The video changed while you were editing it`);
		}
	}

	return (
		<>
			{video === undefined || isFetching ?
				<LoadingSpinner /> :
				<>
					<h3>Editing video: {video.title}</h3>
					<EditVideoForm
						submit={submit}
						defaultValues={{
							title: video.title ?? '',
							description: video.description ?? '',
							visibility: video.visibility,
						}}
						{...state}
					/>
				</>
			}
		</>
	)
}

export default EditPage;
