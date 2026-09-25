import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { fromPromise, isOk } from '@vp/result';
import { z } from 'zod';

import { videosApi } from 'src/modules/shared/api';

import type { EditVideoFormModel } from 'src/modules/shared/models';

import { EditVideoForm } from '../../components';
import { LoadingSpinner } from 'src/modules/shared/components';

const VersionConflictSchema = z.object({ status: z.literal(409) });

export function EditPage() {
	const { videoId } = useParams();

	const { data: video, isFetching, isError } = videosApi.useVideoQuery(videoId ?? '', { skip: !videoId });

	const [edit, state] = videosApi.useUpdateVideoMutation();

	const navigate = useNavigate();

	useEffect(() => {
		if (!isError) return;

		toast("No video with given id exists!");
		navigate("/");
	}, [isError, navigate])

	if (!videoId) return <Navigate to="/" replace />

	const submit = async (form: EditVideoFormModel) => {
		if (!video) return;

		const saved = await fromPromise(
			() => edit({ ...form, id: video.id, version: video.version }).unwrap(),
			(cause) => cause
		);

		if (isOk(saved)) {
			toast('Successfully edited the video');

			navigate(-1);
			return;
		}

		if (VersionConflictSchema.safeParse(saved.error).success) {
			toast('The video changed while you were editing it');
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
