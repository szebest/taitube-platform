import { Navigate, useParams } from 'react-router-dom';

import styles from './video-page.module.scss';

import { useVideoQuery } from 'src/modules/shared/api';

import { LoadingSpinner, VideoPlayer } from "src/modules/shared/components";
import { VideoDetails } from "../../components";

export function VideoPage() {
	const { videoId } = useParams();
	const { data: video, isLoading } = useVideoQuery(videoId ?? '', { skip: !videoId });

	if (!videoId) return <Navigate to="/" />
	if (isLoading) return <LoadingSpinner />
	if (!video) return null;

	return (
		<div className={styles.container}>
			<div className={styles.container__wrapper}>
				<VideoPlayer playbackUrl={video.playbackUrl} />
				<VideoDetails video={video} />
			</div>
		</div>
	)
}
