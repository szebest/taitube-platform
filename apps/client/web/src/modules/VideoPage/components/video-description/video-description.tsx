import { useState } from 'react';

import styles from './video-description.module.scss';

import type { Video } from '@vp/api-contracts';
import { publishedAt } from '@vp/intl';
import { useFormat } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';

const PREVIEW_GRAPHEMES = 255;

export type VideoDescriptionProps = {
	video: Video;
}

export const VideoDescription = ({ video }: VideoDescriptionProps) => {
	const [descriptionExpanded, setDescriptionExpanded] = useState(false);
	const { format, truncate } = useFormat();

	const description = video.description ?? '';
	const preview = unwrapOr(truncate(description, PREVIEW_GRAPHEMES), description);
	const published = publishedAt(video.createdAt);

	const expandButtonClass = [
		'btn',
		styles.descriptionExpandBtn,
		preview === description && styles.hide,
		descriptionExpanded && styles.expanded,
	].filter(Boolean).join(' ');

	return (
		<div className={styles.wrapper}>
			<div className={styles.details}>
				<span title={unwrapOr(format(published.absolute), '')}>{unwrapOr(format(published.relative), '')}</span>
			</div>
			<span className={styles.description}>{descriptionExpanded ? description : preview}</span>
			<button type="button" className={expandButtonClass} onClick={() => setDescriptionExpanded(prev => !prev)}>
				{descriptionExpanded ? 'Show less' : 'Show more'}
			</button>
		</div>
	)
};
