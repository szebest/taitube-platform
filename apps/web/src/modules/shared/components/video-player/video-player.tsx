import { useState } from 'react';
import ReactPlayer from 'react-player';
import { z } from 'zod';

import styles from './video-player.module.scss';

import { useStoredState } from '#app/hooks/use-stored-state';

export type VideoPlayerProps = {
	playbackUrl?: string;
}

const VOLUME_KEY = "VOLUME";

const Volume = z.number().min(0).max(1);

export function VideoPlayer({ playbackUrl }: VideoPlayerProps) {
	const [volume, setVolume] = useStoredState(VOLUME_KEY, Volume, 1);
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
