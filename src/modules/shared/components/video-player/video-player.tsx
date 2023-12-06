import { API_BASE_URL } from 'src/config';

import styles from './video-player.module.scss';
import { useEffect, useMemo } from 'react';
import dashjs from 'dashjs';

export type VideoPlayerProps = {
  video: number;
}

let uniqueId = 0;

export function VideoPlayer({ video }: VideoPlayerProps) {
  const videoId = useMemo(() => `video-player-${uniqueId}`, [])

  useEffect(() => {
    const url = `${API_BASE_URL}/videos/${video}/manifest.mpd`;
    const player = dashjs.MediaPlayer().create();
    const videoPlayer = document.getElementById(videoId);
    
    if (!video) return;

    player.initialize(videoPlayer as HTMLVideoElement, url, true);
  }, [video, videoId]);

  return (
    <div className={styles.container}>
      <video id={videoId} autoPlay controls />
    </div>
  )
}

export default VideoPlayer;
