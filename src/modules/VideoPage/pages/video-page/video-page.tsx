import { Navigate } from 'react-router-dom';

import styles from './video-page.module.scss';

import { VideoPlayer } from "src/modules/shared/components";
import { CommentsSection, VideoDetails } from "../../components";

export type VideoPageProps = {
  param?: number;
}

export function VideoPage({ param }: VideoPageProps) {
  if (param === undefined) return <Navigate to="/" />

  return (
    <div className={styles.container}>
      <div className={styles.container__wrapper}>
        <VideoPlayer videoId={param} />
				<VideoDetails videoId={param} />
				<CommentsSection videoId={param} />
      </div>
    </div>
  )
}

export default VideoPage;
