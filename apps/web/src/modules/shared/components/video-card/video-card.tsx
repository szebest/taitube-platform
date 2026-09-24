import { memo } from "react";
import { Link } from "react-router-dom";

import styles from './video-card.module.scss';

import type { VideoSummary } from "@vp/api-contracts";
import { canUpdateVideo } from "@vp/permissions";

import { Can } from "src/components";
import { formatTimeAgo } from "src/lib";

import { formatNumbers } from "../../helpers";

import { VideoSettingsDropdown } from "..";

export type VideoCardProps = {
	video: VideoSummary;
	zIndex?: number;
}

export const VideoCard = memo(({ video, zIndex }: VideoCardProps) => {
	const videoRoute = `/watch/${video.id}`;

	return (
		<Link style={{ zIndex }} to={videoRoute} className={styles.link}>
			<div className={styles.container}>
				{video.posterUrl &&
					<img className={styles.container__thumb} src={video.posterUrl} loading="lazy" alt="thumbnail" />
				}
				<div className={styles.container__info}>
					<div className={styles.container__main}>
						<div>
							<div className={styles.container__title}>
								<p className={styles.text} title={video.title ?? ''}>{video.title}</p>
							</div>
							<div className={styles.container__meta}>
								<div className={styles.container__meta__stats}>
									<span className={styles.text}>{formatNumbers(video.viewsCount ?? 0)} views</span>
									<span className={styles.seperator} />
									<span className={styles.text}>{formatTimeAgo(new Date(video.createdAt))}</span>
								</div>
							</div>
						</div>
						<div>
							<Can type="rule" I={canUpdateVideo} this={{ video: { id: video.id, ownerId: video.ownerId } }}>
								<VideoSettingsDropdown video={video} />
							</Can>
						</div>
					</div>
					<div className={styles.container__additional}>
						<p className={styles.text} title={video.description ?? ''}>{video.description}</p>
					</div>
				</div>
			</div>
		</Link>
	);
});

export default VideoCard;
