import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Form } from "react-bootstrap";
import { useForm } from "react-hook-form";

import styles from '../video-form.module.scss';

import { VIDEO_VISIBILITIES } from "@vp/api-contracts";

import type { CompletedUpload } from "../../../api";
import type { UploadFormModel } from "../../../models";
import { DropzoneField, UploadProgress } from "../..";

export type VideoFormProps = {
	isError: boolean;
	isSuccess: boolean;
	reset: VoidFunction;
	data?: CompletedUpload;
	submit: (form: UploadFormModel) => void;
}

export const VideoForm = ({ isError, isSuccess, reset: resetMutation, data, submit }: VideoFormProps) => {
	const acceptFileTypes = useMemo(() => ({
		'video/mp4': ['.mp4']
	}), []);

	const {
		register,
		handleSubmit,
		control,
		reset,
		formState: { isSubmitted, isValid }
	} = useForm<UploadFormModel>({ defaultValues: { visibility: 'private' } });

	const clearForm = () => {
		reset();
		resetMutation();
	}

	return (
		<Form onSubmit={handleSubmit((form) => submit(form))} className={styles.form}>
			<DropzoneField
				name='file'
				control={control}
				validation={{ required: true }}
				accept={acceptFileTypes}
				multiple={false}
				placeholderText="Drag 'n' drop, or click to select video file" />

			<Form.Group controlId="title">
				<Form.Label>Video title</Form.Label>
				<Form.Control type="text" {...register('title', { required: true })} />
			</Form.Group>

			<Form.Group controlId="visibility">
				<Form.Label>Visibility</Form.Label>
				<Form.Select aria-label="Video visibility" {...register('visibility', { required: true })}>
					{VIDEO_VISIBILITIES.map((visibility) => (
						<option key={visibility} value={visibility}>{visibility}</option>
					))}
				</Form.Select>
			</Form.Group>

			{
				isSuccess ?
					<button type="button" onClick={clearForm} className='btn btn-primary' aria-label="submit another video">
						Submit another video
					</button> :
					(
						isError ?
							<button type="submit" className='btn btn-danger btn-white-text' aria-label="retry">
								Retry
							</button> :
							<button type="submit" disabled={!isValid || isSubmitted} className='btn btn-primary' aria-label="upload">
								Upload
							</button>
					)
			}

			{isSuccess && data &&
				<Link to={`/watch/${data.videoId}`} className="btn btn-primary">Go to the uploaded video page</Link>
			}

			{isSubmitted && !isError &&
				<UploadProgress />
			}
		</Form>
	);
}

export default VideoForm;
