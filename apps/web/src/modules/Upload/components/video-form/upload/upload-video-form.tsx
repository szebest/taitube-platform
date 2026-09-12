import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Form } from "react-bootstrap";
import { useForm } from "react-hook-form";

import styles from '../video-form.module.scss';

import { getCategories } from "src/modules/shared/helpers";

import { UploadFormModel, UploadResponse } from "../../../models";
import { DropzoneField, UploadProgress } from "../..";

export type VideoFormProps = {
	isEdit: boolean;
	isError: boolean;
	isSuccess: boolean;
	reset: VoidFunction;
	data?: UploadResponse;
	submit: (form: UploadFormModel) => void;
}

export const VideoForm = ({ isEdit, isError, isSuccess, reset: resetMutation, data, submit }: VideoFormProps) => {
	const acceptFileTypes = useMemo(() => ({
		'video/mp4': ['.mp4']
	}), []);

	const categories = useMemo(() => {
		return getCategories();
	}, []);

	const {
		register,
		handleSubmit,
		control,
		reset,
		formState: { isSubmitted, isValid }
	} = useForm<UploadFormModel>();

	const clearForm = () => {
		reset();
		resetMutation();
	}

	return (
		<Form onSubmit={handleSubmit((form) => submit(form))} className={styles.form}>
			{!isEdit &&
				<DropzoneField
					name='file'
					control={control as any}
					validation={{ required: true }}
					accept={acceptFileTypes}
					multiple={false}
					placeholderText="Drag 'n' drop, or click to select video file" />
			}

			<Form.Group controlId="title">
				<Form.Label>Video title</Form.Label>
				<Form.Control type="text" {...register('title', { required: true })} />
			</Form.Group>

			<Form.Group controlId="description">
				<Form.Label>Video description</Form.Label>
				<Form.Control as="textarea" type="text" {...register('description', { required: true })} className={styles.form__textarea} />
			</Form.Group>

			<Form.Group controlId="category">
				<Form.Label>Category</Form.Label>
				<Form.Select defaultValue={-1} aria-label="Video category" {...register('category', { required: true })}>
					{categories.map((category) => (
						<option key={category.id} value={category.id}>{category.value}</option>
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
				<Link to={`/watch/${data.id}`} className="btn btn-primary">Go to the uploaded video page</Link>
			}

			{isSubmitted && !isError &&
				<UploadProgress />
			}
		</Form>
	);
}

export default VideoForm;