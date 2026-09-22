import { Form } from "react-bootstrap";
import { useForm } from "react-hook-form";

import styles from '../video-form.module.scss';

import { VIDEO_VISIBILITIES } from "@vp/api-contracts";

import type { EditVideoFormModel } from "src/modules/shared/models";

export type EditVideoFormProps = {
	isError: boolean;
	isLoading: boolean;
	defaultValues: EditVideoFormModel;
	submit: (form: EditVideoFormModel) => void;
}

export const EditVideoForm = ({ isError, isLoading, defaultValues, submit }: EditVideoFormProps) => {
	const {
		register,
		handleSubmit,
		formState: { isValid }
	} = useForm<EditVideoFormModel>({ defaultValues });

	return (
		<Form onSubmit={handleSubmit((form) => submit(form))} className={styles.form}>
			<Form.Group controlId="title">
				<Form.Label>Video title</Form.Label>
				<Form.Control type="text" {...register('title', { required: true })} />
			</Form.Group>

			<Form.Group controlId="description">
				<Form.Label>Video description</Form.Label>
				<Form.Control as="textarea" type="text" {...register('description', { required: true })} className={styles.form__textarea} />
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
				isError ?
					<button type="submit" className='btn btn-danger btn-white-text' aria-label="retry">
						Retry
					</button> :
					<button type="submit" disabled={!isValid || isLoading} className='btn btn-primary' aria-label="upload">
						Edit
					</button>
			}
		</Form>
	);
}

export default EditVideoForm;
