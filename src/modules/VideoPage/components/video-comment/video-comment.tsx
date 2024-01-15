import { memo, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dropdown } from 'react-bootstrap';

import styles from './video-comment.module.scss';

import { timeAgo } from 'src/lib';

import { useDeleteVideoCommentMutation } from '../../api/videoApiSlice';

import { useAuth } from 'src/modules/shared/providers';

import { VideoComment as VideoCommentModel } from '../../models';

import { AddVideoComment } from '../add-video-comment/add-video-comment';
import { ProfilePicture } from 'src/modules/shared/components';

export type VideoCommentProps = {
	comment: VideoCommentModel;
}

export const VideoComment = memo(({ comment }: VideoCommentProps) => {
	const [isEditing, setIsEditing] = useState(false);

	const { user } = useAuth();
	const [deleteVideoComment] = useDeleteVideoCommentMutation();

	const handleDelete = () => {
		if (comment.id === undefined) return;

		deleteVideoComment({
			id: comment.id,
			videoId: comment.videoId
		});
	}

	const handleEdit = () => {
		setIsEditing(true);
	}

	const handleCancelEdit = useCallback(() => {
		setIsEditing(false);
	}, []);

	if (isEditing) return <AddVideoComment {...comment} loadingComments={false} initialText={comment.data} onClose={handleCancelEdit} />

	const commentLoading = comment.id === undefined;
	const userProfileRoute = `/user/${comment.userId}`;

	return (
		<div className={styles.container}>
			<div className={`${styles.column} ${commentLoading ? styles.loading : ''}`}>
				<Link to={userProfileRoute} className={styles.column__avatar}>
					<ProfilePicture src={comment.profilePictureSrc} />
				</Link>
				<div className={styles.wrapper} >
					<div className={styles.wrapper__top}>
						<span className={styles.username}><Link to={userProfileRoute} className={comment.userId === -1 ? 'disabled' : ''}>{comment.fullName}</Link> </span>
						<span className={styles.date}>{timeAgo.format(new Date(comment.createdAt))}</span>
					</div>
					<div className={styles.wrapper__comment}>
						<p>{comment.data}</p>
					</div>
				</div>
			</div>
			{user && comment.userId === user.id &&
				<div>
					<Dropdown>
						<Dropdown.Toggle as='div' aria-label='comment actions'>
							<button className={`btn btn-transparent btn-round ${styles.toggle}`}>
								<i className="bi bi-three-dots-vertical"></i>
							</button>
						</Dropdown.Toggle>

						<Dropdown.Menu className={`${styles.dropdown} light`}>
							<Dropdown.Item as='div'>
								<button className='btn-initial' onClick={handleEdit}>
									<i className="bi bi-pencil"></i>
									<span>Edit</span>
								</button>
							</Dropdown.Item>

							<Dropdown.Divider></Dropdown.Divider>

							<Dropdown.Item as='div'>
								<button className='btn-initial' onClick={handleDelete}>
									<i className="bi bi-trash"></i>
									<span>Delete</span>
								</button>
							</Dropdown.Item>
						</Dropdown.Menu>
					</Dropdown>
				</div>
			}
		</div>
	)
});

export default VideoComment;