import { VoiceBar } from '#app/components/party/voice-bar';
import { usePlayerFullscreen } from '#app/components/player/taitube-player';
import { useVoice } from './voice-context';

/** The small push-to-talk button drawn over the player, so it stays within reach in landscape fullscreen. */
export function VoiceHoldOverlay() {
  const voice = useVoice();
  const fullscreen = usePlayerFullscreen();
  const snapshot = voice?.snapshot;

  if (
    !voice ||
    !fullscreen ||
    snapshot?.phase !== 'live' ||
    !snapshot.canSpeak ||
    !snapshot.pushToTalk
  ) {
    return null;
  }

  return (
    <VoiceBar.Hold
      compact
      held={snapshot.held}
      onHeldChange={(held) => voice.session?.hold(held)}
      className="absolute inset-e-2 bottom-2"
    />
  );
}
