import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { Navigate, useNavigate } from 'react-router-dom';
import { FetchBaseQueryError } from '@reduxjs/toolkit/query';

import { useEditVideoMutation, useVideoInfoQuery } from 'src/modules/shared/api';

import { useAuth } from 'src/modules/shared/providers';

import { EditVideoFormModel } from 'src/modules/shared/models';

import { EditVideoForm } from '../../components';
import { LoadingSpinner } from 'src/modules/shared/components';

export type EditPageProps = {
	videoId?: number;
}

export function EditPage({ videoId }: EditPageProps) {
	const { data, isFetching, isError } = useVideoInfoQuery(videoId ?? -1, {
		skip: videoId === undefined
	});

	const { user, isLoading } = useAuth();

	const [edit, state] = useEditVideoMutation();

	const navigate = useNavigate();

	useEffect(() => {
		if (!isError) return;

		toast("No video with given id exists!");
		navigate("/");
	}, [isError])

	useEffect(() => {
		if (!data || isLoading) return;
		if (data.userId !== user?.id) {
			toast("This is not yours video!");
			navigate("/");
		}
	}, [data, isLoading, user])

	if (videoId === undefined) return <Navigate to="/" replace />

	const submit = async (form: EditVideoFormModel) => {
		const response = await edit({ ...form, videoId });

		if ("data" in response) {
			toast(`Successfully edited the video`);

			navigate(-1);
		}
		else {
			if ((response.error as FetchBaseQueryError)?.status === 404) {
				toast(`Video does not exist`);

				navigate(-1);
			}
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
