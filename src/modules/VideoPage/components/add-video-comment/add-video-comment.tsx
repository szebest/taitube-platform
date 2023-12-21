import { useForm } from 'react-hook-form';
import { Form } from 'react-bootstrap';

import styles from './add-video-comment.module.scss';

import { useAddVideoCommentMutation } from '../../api/videoApiSlice';

import { AddVideoComment as AddVideoCommentModel } from '../../models';
import { User } from 'src/modules/shared/models';

import { ProfilePicture } from 'src/modules/shared/components';

export type AddVideoCommentProps = {
	videoId: number;
	user: User;
	loadingComments: boolean;
}

export const AddVideoComment = ({ videoId, user, loadingComments }: AddVideoCommentProps) => {
	const [addVideoComment, { isLoading }] = useAddVideoCommentMutation();

	const {
		register,
		handleSubmit,
		reset,
		formState: { isValid }
	} = useForm<AddVideoCommentModel>({ defaultValues: { data: "" } });

	const submit = (body: AddVideoCommentModel) => {
		reset();

		addVideoComment({
			videoId,
			body,
			user
		});
	}

	return (
		<div className={styles.container}>
			<ProfilePicture src={user.profilePictureSrc} />
			<Form className={styles.container__form} onSubmit={handleSubmit(submit)}>
				<Form.Group controlId="description">
					<Form.Control as="textarea" disabled={loadingComments} type="text" {...register('data', { required: true })} className={styles.form__textarea} />
				</Form.Group>
				<div className={styles.container__form__buttons}>
					<button type="button" disabled={!isValid || isLoading || loadingComments} className="btn btn-secondary btn-md" onClick={() => reset()}>Cancel</button>
					<button type="submit" disabled={!isValid || isLoading || loadingComments} className="btn btn-primary btn-md">Comment</button>
				</div>
			</Form>
		</div>
	)
}
