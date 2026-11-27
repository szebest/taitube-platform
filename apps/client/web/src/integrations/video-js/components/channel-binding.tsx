import { type RefObject, useEffect } from 'react';
import { useOfferedPlayerChannel } from '#app/lib/player/player-channel';
import { usePlayerCommands } from '../hooks/use-player-commands';
import { usePlayerState } from '../hooks/use-player-state';

export function ChannelBinding({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
  const channel = useOfferedPlayerChannel();
  const { seek, requestPictureInPicture, exitPictureInPicture } = usePlayerCommands();
  const fullscreen = usePlayerState((state) => state.fullscreen);
  const captionTrackId = usePlayerState((state) => state.activeCaptionTrack?.id ?? null);
  const canPictureInPicture = usePlayerState((state) => state.canPictureInPicture);
  const pictureInPicture = usePlayerState((state) => state.pictureInPicture);

  useEffect(() => channel?.attach(seek), [channel, seek]);

  useEffect(() => {
    const video = videoRef.current;
    if (!channel || !video) {
      return;
    }

    const publishTime = () => channel.publish(video.currentTime);
    publishTime();
    video.addEventListener('timeupdate', publishTime);
    video.addEventListener('seeked', publishTime);
    return () => {
      video.removeEventListener('timeupdate', publishTime);
      video.removeEventListener('seeked', publishTime);
    };
  }, [channel, videoRef]);

  useEffect(() => {
    channel?.publishFullscreen(fullscreen);
  }, [channel, fullscreen]);

  useEffect(() => {
    channel?.publishPictureInPicture({ available: canPictureInPicture, active: pictureInPicture });
  }, [channel, canPictureInPicture, pictureInPicture]);

  useEffect(
    () =>
      channel?.attachPictureInPicture(
        pictureInPicture ? exitPictureInPicture : requestPictureInPicture
      ),
    [channel, pictureInPicture, requestPictureInPicture, exitPictureInPicture]
  );

  useEffect(() => {
    channel?.publishCaptionTrack(captionTrackId);
  }, [channel, captionTrackId]);

  return null;
}
