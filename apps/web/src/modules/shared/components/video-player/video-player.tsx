import { useState } from 'react';
import ReactPlayer from 'react-player';
import { useLocalStorage } from '@uidotdev/usehooks';

import styles from './video-player.module.scss';

export type VideoPlayerProps = {
	playbackUrl?: string;
}

const VOLUME_KEY = "VOLUME";

export function VideoPlayer({ playbackUrl }: VideoPlayerProps) {
	const [volume, setVolume] = useLocalStorage(VOLUME_KEY, 1);
	const [seeking, setSeeking] = useState(false);

	if (!playbackUrl) return null;

	return (
		<div className={styles.container}>
			<ReactPlayer
				url={playbackUrl}
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
