import { Navigate, useParams } from "react-router-dom";

import styles from './video-page.module.scss';

import { VideoPlayer } from "src/modules/shared/components";

export function VideoPage() {
  const { videoId } = useParams();

  if (videoId === undefined || parseInt(videoId).toString() !== videoId) return <Navigate to="/" replace/>

  return (
    <div className={styles.container}>
      <div className={styles.container__wrapper}>
        <VideoPlayer video={parseInt(videoId)}></VideoPlayer>
      </div>
    </div>
  )
}

export default VideoPage;
