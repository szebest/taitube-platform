import type { PartyRosterEntry } from '@vp/queries';
import { useVoice } from './voice-context';
import { LazyVoiceDock } from './voice-dock.lazy';

/** Mounts the voice dock, and with it the LiveKit client, only once the viewer has asked to join. */
export function VoiceDockSlot({
  roomId,
  roster,
}: {
  roomId: string;
  roster: readonly PartyRosterEntry[];
}) {
  const voice = useVoice();

  if (!voice || (voice.snapshot.phase === 'idle' && !voice.joining && !voice.failure)) {
    return null;
  }

  return <LazyVoiceDock roomId={roomId} roster={roster} />;
}
