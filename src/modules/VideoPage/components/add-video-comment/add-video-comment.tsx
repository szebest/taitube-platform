import { useForm } from 'react-hook-form';
import { Form } from 'react-bootstrap';

import styles from './add-video-comment.module.scss';

import { useAddVideoCommentMutation, useEditVideoCommentMutation } from '../../api/videoApiSlice';

import { useAuth } from 'src/modules/shared/providers';

import { AddVideoComment as AddVideoCommentModel } from '../../models';

import { ProfilePicture } from 'src/modules/shared/components';

export type AddVideoCommentProps = {
	id?: number;
	videoId: number;
	loadingComments: boolean;
	onClose?: VoidFunction;
	initialText?: string;
}

export const AddVideoComment = ({ id, videoId, loadingComments, onClose, initialText }: AddVideoCommentProps) => {
	const { user, isLoading: userIsLoading } = useAuth();
	const [addVideoComment, { isLoading }] = useAddVideoCommentMutation();
	const [editVideoComment] = useEditVideoCommentMutation();

	const {
		register,
		handleSubmit,
		reset,
		formState: { isValid }
	} = useForm<AddVideoCommentModel>({ defaultValues: { data: initialText } });

	const submit = (body: AddVideoCommentModel) => {
		reset();

		if (id !== undefined) {
			editVideoComment({
				id,
				videoId,
				body
			});
		}
		else {
			addVideoComment({
				videoId,
				body,
				user
			});
		}

		onClose?.();
	}

	const handleCancel = () => {
		onClose?.();
		reset();
	}

	if (userIsLoading || !user) return null;

	return (
		<div className={styles.container}>
			<div className={styles.container__avatar}>
				<ProfilePicture src={user.profilePictureSrc} />
			</div>
			<Form className={styles.container__form} onSubmit={handleSubmit(submit)}>
				<Form.Group controlId="description">
					<Form.Control as="textarea" disabled={loadingComments} type="text" {...register('data', { required: true })} className={styles.form__textarea} aria-label="Comment text" />
				</Form.Group>
				<div className={styles.container__form__buttons}>
					<button type="button" disabled={(!isValid || isLoading || loadingComments) && id === undefined} className="btn btn-secondary btn-md btn-white-text" onClick={handleCancel}>Cancel</button>
					<button type="submit" disabled={!isValid || isLoading || loadingComments} className="btn btn-primary btn-md btn-white-text">
						{initialText === undefined ? 'Comment' : 'Edit'}
					</button>
				</div>
			</Form>
		</div>
	)
}
