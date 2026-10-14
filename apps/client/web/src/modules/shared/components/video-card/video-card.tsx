import { memo } from "react";
import { Link } from "@tanstack/react-router";

import styles from './video-card.module.scss';

import type { VideoSummary } from "@vp/api-contracts";
import { publishedAt } from "@vp/intl";
import { Format, useT } from "@vp/intl-react";
import { canUpdateVideo } from "@vp/permissions";

import { Can } from "#app/components";

import { VideoSettingsDropdown } from "..";

export type VideoCardProps = {
	video: VideoSummary;
	zIndex?: number;
}

export const VideoCard = memo(({ video, zIndex }: VideoCardProps) => {
	const { tOr } = useT();
	return (
		<Link style={{ zIndex }} to="/watch/$videoId" params={{ videoId: video.id }} className={styles.link}>
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
									<span className={styles.text}>{tOr('videos.views', { count: video.viewsCount ?? 0 }, '')}</span>
									<span className={styles.seperator} />
									<span className={styles.text}><Format value={publishedAt(video.createdAt).relative} /></span>
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
