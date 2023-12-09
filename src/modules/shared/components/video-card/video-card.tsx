import { memo } from "react";
import { Link } from "react-router-dom";

import styles from './video-card.module.scss';

import { timeAgo } from "src/lib";

import { Video } from "../../models";

import { formatNumbers, mapCategory } from "../../helpers";

export type VideoCardProps = {
	video: Video;
}

export const VideoCard = memo(({ video }: VideoCardProps) => {
	return (
		<Link to={`/watch/${video.id}`} className={styles.link}>
			<div className={styles.container}>
				<img className={styles.container__thumb} src={video.thumbnailSrc ?? 'https://picsum.photos/200/112'} loading="lazy" alt="thumbnail" />
				<div className={styles.container__info}>
					<div className={styles.container__title}>
						<p className={styles.text}>{video.title}</p>
					</div>
					<div className={styles.container__stats}>
						{/* TODO views */}
						<span className={styles.text}>{formatNumbers(video.views ?? 999)} views</span>
						<span className={styles.seperator}></span>
						<span className={styles.text}>{timeAgo.format(new Date(video.createdAt))}</span>
					</div>
					<div className={styles.container__additional}>
						<p className={styles.text}>{video.description}</p>
						<span className="chip">{mapCategory(video.category)}</span>
					</div>
				</div>
			</div>
		</Link>
	);
});

export default VideoCard;
