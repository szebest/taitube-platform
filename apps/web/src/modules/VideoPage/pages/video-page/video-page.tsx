import { Navigate } from 'react-router-dom';

import styles from './video-page.module.scss';

import { VideoPlayer } from "src/modules/shared/components";
import { CommentsSection, VideoDetails } from "../../components";

export type VideoPageProps = {
	videoId?: number;
}

export function VideoPage({ videoId }: VideoPageProps) {
	if (videoId === undefined) return <Navigate to="/" />

	return (
		<div className={styles.container}>
			<div className={styles.container__wrapper}>
				<VideoPlayer videoId={videoId} />
				<VideoDetails videoId={videoId} />
				<CommentsSection videoId={videoId} />
			</div>
		</div>
	)
}

export default VideoPage;
