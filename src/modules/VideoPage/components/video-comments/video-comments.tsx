import styles from './video-comments.module.scss';

import { VideoComment } from '..';
import { VideoComment as VideoCommentModel } from '../../models';

export type CommentsSectionProps = {
	data: VideoCommentModel[]
}

export const VideoComments = ({ data }: CommentsSectionProps) => {
	return (
		<div className={styles.container}>
			{
				data.map((comment, index) => (
					<VideoComment key={index} comment={comment} />
				))
			}
			{data.length === 0 && <div>There are no comments for this video</div>}
		</div>
	)
}

export default VideoComments;