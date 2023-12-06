import { useEffect, useRef } from 'react';
import dashjs from 'dashjs';

import styles from './video-player.module.scss';

import { API_BASE_URL } from 'src/config';

export type VideoPlayerProps = {
  video: number;
}

export function VideoPlayer({ video }: VideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoPlayer = ref.current;
    console.log(videoPlayer)
    if (video === null) return;

    const url = `${API_BASE_URL}/videos/${video}/manifest.mpd`;
    const player = dashjs.MediaPlayer().create();

    player.initialize(videoPlayer as HTMLVideoElement, url, true);
  }, [video, ref]);

  return (
    <div className={styles.container}>
      <video ref={ref} autoPlay controls />
    </div>
  )
}

export default VideoPlayer;
