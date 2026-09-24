import styles from './video-details.module.scss';

import type { Video } from '@vp/api-contracts';
import { canUpdateVideo } from '@vp/permissions';

import { Can } from 'src/components';

import { VideoSettingsDropdown } from 'src/modules/shared/components';

import { VideoDescription, VideoLikes } from '..';

export type VideoDetailsProps = {
	video: Video;
}

export const VideoDetails = ({ video }: VideoDetailsProps) => {
	return (
		<div className={styles.container}>
			<div className={styles.top}>
				<h4 className={styles.title} title={video.title ?? ''}>{video.title}</h4>
				<Can type="rule" I={canUpdateVideo} this={{ video: { id: video.id, ownerId: video.ownerId } }}>
					<VideoSettingsDropdown video={video} shouldRedirectOnDelete />
				</Can>
			</div>
			<div className={styles.wrapper}>
				<div className={styles.right}>
					<VideoLikes video={video} />
				</div>
			</div>
			<VideoDescription video={video} />
		</div>
	)
};
