import { memo } from 'react';
import { Link } from 'react-router-dom';

import styles from './video-comment.module.scss';

import { timeAgo } from 'src/lib';

import { VideoComment as VideoCommentModel } from '../../models';

export type VideoCommentProps = {
	comment: VideoCommentModel;
}

export const VideoComment = memo(({ comment }: VideoCommentProps) => {
  return (
    <div className={`${styles.container} ${comment.loading ? styles.loading : ''}`}>
			<div className={styles.container__top}>
				<span className={styles.username}><Link to={`/user/${comment.userId}`} className={comment.userId.length === 0 ? 'disabled' : ''}>{comment.fullName}</Link> </span>
				{!comment.loading && <span className={styles.date}>{timeAgo.format(new Date(comment.createdAt))}</span>}
			</div>
			<div className={styles.container__comment}>
				<p>{comment.data}</p>
			</div>
		</div>
  )
});

export default VideoComment;