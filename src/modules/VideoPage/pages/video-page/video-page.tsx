import { Navigate, useParams } from "react-router-dom";

import styles from './video-page.module.scss';

import { VideoPlayer } from "src/modules/shared/components";
import { AddVideoComment, VideoComments } from "../../components";
import { useAuth } from "src/modules/shared/providers";
import CommentsSection from "../../components/comments-section/comments-section";

export function VideoPage() {
  const { videoId } = useParams();

  if (videoId === undefined || parseInt(videoId).toString() !== videoId) return <Navigate to="/" replace/>

  return (
    <div className={styles.container}>
      <div className={styles.container__wrapper}>
        <VideoPlayer video={parseInt(videoId)} />
				<CommentsSection videoId={parseInt(videoId)} />
      </div>
    </div>
  )
}

export default VideoPage;
