import { useState } from 'react';

import styles from './video-description.module.scss';

import type { Video } from '@vp/api-contracts';

import { formatTimeAgo } from 'src/lib';

export type VideoDescriptionProps = {
	video: Video;
}

export const VideoDescription = ({ video }: VideoDescriptionProps) => {
	const [descriptionExpanded, setDescriptionExpanded] = useState(false);

	const description = video.description ?? '';
	const descriptionSubstring = description.substring(0, 255);

	return (
		<div className={styles.wrapper}>
			<div className={styles.details}>
				<span title={new Date(video.createdAt).toLocaleString()}>{formatTimeAgo(new Date(video.createdAt).getTime() - 10000)}</span>
			</div>
			<span className={styles.description}>{descriptionExpanded ? description : descriptionSubstring}</span>
			<button type="button" className={`${styles.descriptionExpandBtn} ${descriptionSubstring.length === description.length ? styles.hide : ''} ${descriptionExpanded ? styles.expanded : ''} btn`} onClick={() => setDescriptionExpanded(prev => !prev)}>
				{descriptionExpanded ? 'Show less' : 'Show more'}
			</button>
		</div>
	)
};
