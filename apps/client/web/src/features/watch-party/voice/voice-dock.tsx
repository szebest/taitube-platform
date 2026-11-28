import type { PartyRosterEntry } from '@vp/queries';
import { z } from 'zod';
import { VoiceBar } from '#app/components/party/voice-bar';
import { VoiceTiles } from '#app/components/party/voice-tile';
import { useStoredState } from '#app/hooks/use-stored-state';
import { useT } from '#app/lib/messages';
import { useTalkingLine } from './use-talking-line';
import { useVoice } from './voice-context';
import { VoiceMenu } from './voice-menu';

interface VoiceDockProps {
  roomId: string;
  roster: readonly PartyRosterEntry[];
}

/** Everything of the voice a joined viewer sees under the stage; loaded only once someone joins. */
export function VoiceDock({ roomId, roster }: VoiceDockProps) {
  const voice = useVoice();
  const { tOr } = useT();
  const [recordingNoticeSeen, setRecordingNoticeSeen] = useStoredState(
    `vp.party.voice.notice.${roomId}`,
    z.boolean(),
    false
  );
  const nameOf = (identity: string) =>
    roster.find((person) => person.memberKey === identity)?.name ?? '';
  const talking = useTalkingLine(
    voice?.snapshot.speaking.map(nameOf).filter((name) => name !== '') ?? []
  );

  if (!voice) {
    return null;
  }

  const { snapshot, speakersFull, failure } = voice;
  const live = snapshot.phase === 'live';
  const inVoice = roster.filter((person) => person.voice !== 'off');

  return (
    <div data-slot="voice-dock" className="flex flex-col gap-inline">
      <VoiceBar.Root>
        {live && snapshot.canSpeak && snapshot.pushToTalk && (
          <VoiceBar.Hold held={snapshot.held} onHeldChange={(held) => voice.session?.hold(held)} />
        )}
        {live && snapshot.canSpeak && (
          <VoiceBar.Notice
            action={{
              label: tOr(snapshot.selfMuted ? 'party.voiceUnmute' : 'party.voiceMute', {}, ''),
              onAction: () => voice.setSelfMuted(!snapshot.selfMuted),
            }}
          >
            {tOr(snapshot.pushToTalk ? 'party.voiceHoldHint' : 'party.voiceMicOpen', {}, '')}
          </VoiceBar.Notice>
        )}
        <VoiceMenu />
        <VoiceBar.Talking names={talking} />
      </VoiceBar.Root>
      {speakersFull && (
        <VoiceBar.Notice
          action={{
            label: tOr('party.voiceRequestToSpeak', {}, ''),
            onAction: voice.requestToSpeak,
          }}
        >
          {tOr('party.voiceSpeakersFull', {}, '')}
        </VoiceBar.Notice>
      )}
      {snapshot.micPaused && (
        <VoiceBar.Notice
          action={{
            label: tOr('party.voiceResumeMic', {}, ''),
            onAction: () => voice.session?.resumeMic(),
          }}
        >
          {tOr('party.voiceMicPaused', {}, '')}
        </VoiceBar.Notice>
      )}
      {snapshot.phase === 'dropped' && (
        <VoiceBar.Notice
          action={{ label: tOr('party.voiceReconnect', {}, ''), onAction: () => void voice.join() }}
        >
          {tOr('party.voiceDropped', {}, '')}
        </VoiceBar.Notice>
      )}
      {failure && (
        <VoiceBar.Notice
          action={{ label: tOr('party.voiceRetry', {}, ''), onAction: () => void voice.join() }}
        >
          {tOr('party.voiceUnavailable', {}, '')}
        </VoiceBar.Notice>
      )}
      {live && !recordingNoticeSeen && (
        <VoiceBar.Notice
          action={{
            label: tOr('party.voiceDismiss', {}, ''),
            onAction: () => setRecordingNoticeSeen(true),
          }}
        >
          {tOr('party.voiceNotRecorded', {}, '')}
        </VoiceBar.Notice>
      )}
      {inVoice.length > 0 && (
        <VoiceTiles.List>
          {inVoice.map((person) => (
            <VoiceTiles.Tile
              key={person.memberKey}
              name={person.name}
              avatarUrl={person.avatarUrl}
              speaking={snapshot.speaking.includes(person.memberKey)}
              muted={person.voice === 'self_muted' || person.voice === 'server_muted'}
            />
          ))}
        </VoiceTiles.List>
      )}
    </div>
  );
}
