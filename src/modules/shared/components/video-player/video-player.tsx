import { useEffect, useRef } from 'react';
import dashjs from 'dashjs';

import styles from './video-player.module.scss';

import { API_BASE_URL } from 'src/config';

export type VideoPlayerProps = {
  videoId: number;
}

export function VideoPlayer({ videoId }: VideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoPlayer = ref.current;
    if (videoPlayer === null) return;

    const url = `${API_BASE_URL}/videos/${videoId}/manifest.mpd`;
    const player = dashjs.MediaPlayer().create();

    player.initialize(videoPlayer, url, true);

    return () => {
      player.destroy();
    }
  }, [videoId, ref]);

  return (
    <div className={styles.container}>
      <video ref={ref} autoPlay controls />
    </div>
  )
}

export default VideoPlayer;
