import { useParams } from "react-router-dom";

import styles from './video-page.module.scss';

import { VideoPlayer } from "src/modules/shared/components";

export function VideoPage() {
  const { videoId } = useParams();

  return (
    <div className={styles.container}>
      <div className={styles.container__wrapper}>
        <VideoPlayer video={videoId!} paused={false}></VideoPlayer>
      </div>
    </div>
  )
}

export default VideoPage;
