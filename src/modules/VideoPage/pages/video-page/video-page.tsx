import { Navigate, useParams } from "react-router-dom";

import styles from './video-page.module.scss';

import { VideoPlayer } from "src/modules/shared/components";
import { CommentsSection, VideoDetails } from "../../components";

export function VideoPage() {
  const { videoId } = useParams();

	const videoIdParsed = parseInt(videoId!);
  
  if (isNaN(videoIdParsed)) return <Navigate to="/" replace/>

  return (
    <div className={styles.container}>
      <div className={styles.container__wrapper}>
        <VideoPlayer videoId={videoIdParsed} />
				<VideoDetails videoId={videoIdParsed} />
				<CommentsSection videoId={videoIdParsed} />
      </div>
    </div>
  )
}

export default VideoPage;
