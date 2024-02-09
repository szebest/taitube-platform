import { Navigate, useNavigate } from 'react-router-dom';

import { useEditVideoMutation, useVideoInfoQuery } from 'src/modules/shared/api';

import { EditVideoFormModel } from 'src/modules/shared/models';

import { EditVideoForm } from '../../components';
import { LoadingSpinner } from 'src/modules/shared/components';
import { toast } from 'react-toastify';
import { useEffect } from 'react';

export type EditPageProps = {
	videoId?: number;
}

export function EditPage({ videoId }: EditPageProps) {
	const { data, isFetching, isError } = useVideoInfoQuery(videoId ?? -1, {
		skip: videoId === undefined
	});
	const [edit, state] = useEditVideoMutation();

	const navigate = useNavigate();

	useEffect(() => {
		if (!isError) return;

		toast("No video with given id exists!");
		navigate("/");
	}, [isError])

	if (videoId === undefined) return <Navigate to="/" replace />

	const submit = async (form: EditVideoFormModel) => {
		const response = await edit({ ...form, videoId });

		if ("data" in response) {
			toast(`Successfully edited the video`);

			navigate(-1);
		}
	}

	return (
		<>
			{data === undefined || isFetching ?
				<LoadingSpinner /> :
				<>
					<h3>Editing video: {data.title}</h3>
					<EditVideoForm submit={submit} defaultValues={data} {...state} />
				</>
			}
		</>
	)
}

export default EditPage;
