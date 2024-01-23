import { useState } from 'react';

import styles from './video-player.module.scss';

import { API_BASE_URL } from 'src/config';
import ReactPlayer from 'react-player';

export type VideoPlayerProps = {
  videoId: number;
}

export function VideoPlayer({ videoId }: VideoPlayerProps) {
	const [seeking, setSeeking] = useState(false);

  return (
    <div className={styles.container}>
			<ReactPlayer
        url={`${API_BASE_URL}/videos/${videoId}/manifest.mpd`}
        playing={!seeking}
				controls
				width='100%'
        height='100%'
				onSeek={() => setSeeking(true)}
      />
    </div>
  )
}

export default VideoPlayer;
