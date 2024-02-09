import { useState } from 'react';
import ReactPlayer from 'react-player';
import { useLocalStorage } from '@uidotdev/usehooks';

import styles from './video-player.module.scss';

import { API_BASE_URL } from 'src/config';

export type VideoPlayerProps = {
  videoId: number;
}

const VOLUME_KEY = "VOLUME";

export function VideoPlayer({ videoId }: VideoPlayerProps) {
	const [volume, setVolume] = useLocalStorage(VOLUME_KEY, 1);
	const [seeking, setSeeking] = useState(false);

	return (
 		<div className={styles.container}>
			<ReactPlayer
				url={`${API_BASE_URL}/videos/${videoId}/manifest.mpd`}
				playing={!seeking}
				volume={volume}
				controls
				width='100%'
				height='100%'
				onSeek={() => setSeeking(true)}
				onReady={(player) => {
					const internalPlayer = player.getInternalPlayer() as HTMLVideoElement;

					internalPlayer.addEventListener('volumechange', () => {
						setVolume(internalPlayer.volume);
					})
				}}
 			/>
 		</div>
	)
}

export default VideoPlayer;
