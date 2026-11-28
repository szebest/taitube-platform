import { Button } from '@kit/ui';
import { usePartyCan } from '@vp/permissions-react';
import { useT } from '#app/lib/messages';
import { useVoice } from './voice-context';

/** Joins or leaves the room's voice from a tap, which is what starts the audio session on iOS. */
export function VoiceJoinButton() {
  const voice = useVoice();
  const { tOr } = useT();
  const canJoin = usePartyCan({ kind: 'permission', permission: 'voice.join' });

  if (!voice || !canJoin) {
    return null;
  }

  const inVoice = voice.snapshot.phase !== 'idle';

  return (
    <Button
      size="sm"
      variant={inVoice ? 'soft' : 'solid'}
      loading={voice.joining}
      onClick={() => void (inVoice ? voice.leave() : voice.join())}
    >
      {tOr(inVoice ? 'party.voiceLeave' : 'party.voiceJoin', {}, '')}
    </Button>
  );
}
