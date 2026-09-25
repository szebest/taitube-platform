import { useSuspenseQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';

import styles from './video-page.module.scss';

import { videoQueryOptions } from '#app/features/watch/api/video-query-options';
import { WatchPlayer } from '#app/features/watch/components/watch-player';

import { VideoDetails } from "#app/modules/VideoPage/components";

export function VideoPage() {
	const { videoId } = useParams({ from: '/watch/$videoId' });
	const { data: video } = useSuspenseQuery(videoQueryOptions(videoId));

	return (
		<div className={styles.container}>
			<div className={styles.container__wrapper}>
				<WatchPlayer playbackUrl={video.playbackUrl} posterUrl={video.posterUrl} />
				<VideoDetails video={video} />
			</div>
		</div>
	)
}
