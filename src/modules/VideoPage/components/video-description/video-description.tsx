import { useState } from 'react';

import styles from './video-description.module.scss';

import { timeAgo } from 'src/lib';

import { formatNumbers, mapCategory } from 'src/modules/shared/helpers';

import { VideoDetails } from '../../models';

export type VideoDescriptionProps = {
	data: VideoDetails;
}

export const VideoDescription = ({ data }: VideoDescriptionProps) => {
	const [descriptionExpanded, setDescriptionExpanded] = useState(false);

	const descriptionSubstring = data.description.substring(0, 255);

	return (
		<div className={styles.wrapper}>
			<div className={styles.details}>
				<span>{formatNumbers(data.views, data.views >= 10000 ? 0 : 1)} views</span>
				<span>{timeAgo.format(new Date(data.createdAt))}</span>
				<span className="chip">{mapCategory(data.category)}</span>
			</div>
			<span className={styles.description}>{descriptionExpanded ? data.description : descriptionSubstring}</span>
			<button className={`${styles.descriptionExpandBtn} ${descriptionSubstring.length === data.description.length ? styles.hide : ''} btn`} onClick={() => setDescriptionExpanded(prev => !prev)}>
				{descriptionExpanded ? 'Show less' : 'Show more'}
			</button>
		</div>
	)
};

export default VideoDescription;