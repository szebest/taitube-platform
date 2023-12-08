import { useForm } from 'react-hook-form';
import { Form } from 'react-bootstrap';

import styles from './add-video-comment.module.scss';

import { useAddVideoCommentMutation } from '../../api/videoApiSlice';

import { AddVideoComment as AddVideoCommentModel } from '../../models';
import { User } from 'src/modules/shared/models';

export type AddVideoCommentProps = {
	videoId: number;
	user: User;
	loadingComments: boolean;
}

export const AddVideoComment = ({ videoId, user, loadingComments }: AddVideoCommentProps) => {
	const [addVideoComment, { reset: resetMutation }] = useAddVideoCommentMutation();

	const {
		register,
		handleSubmit,
		reset,
		formState: { isSubmitted, isValid }
	} = useForm();

	const submit = async (form: AddVideoCommentModel) => {
		try {
			await addVideoComment({
				videoId,
				body: form,
				user
			});
		}
		finally {
			setTimeout(() => {
				resetMutation();
				reset();
			}, 0);
		}
  }

	return (
		<div className={styles.container}>
			<div>
				<img className="profile-picture-img" src={user.profilePictureSrc} alt="profile" />
			</div>
			<Form className={styles.container__form} onSubmit={handleSubmit((form) => submit(form as AddVideoCommentModel))}>
				<Form.Group controlId="description">
					<Form.Control as="textarea" disabled={loadingComments} type="text" {...register('data', { required: true })} className={styles.form__textarea} />
				</Form.Group>
				<div className={styles.container__form__buttons}>
					<button type="button" disabled={!isValid || isSubmitted || loadingComments} className="btn btn-secondary" onClick={reset}>Cancel</button>
					<button type="submit" disabled={!isValid || isSubmitted || loadingComments} className="btn btn-primary">Comment</button>
				</div>
			</Form>
		</div>
	)
}
