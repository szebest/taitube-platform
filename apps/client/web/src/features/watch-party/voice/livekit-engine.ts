import { type Participant, type RemoteParticipant, Room, RoomEvent, Track } from 'livekit-client';
import type { CaptureOptions, VoiceDevice, VoiceEngine, VoiceEngineEvent } from './voice-port';

function toDevices(infos: readonly MediaDeviceInfo[]): VoiceDevice[] {
  return infos
    .filter(({ deviceId }) => deviceId !== '')
    .map(({ deviceId, label }) => ({ id: deviceId, label: label || deviceId }));
}

/** The voice port over a LiveKit room: audio only, gain through the Web Audio graph so a member can go past 100 %. */
export function createLivekitEngine(): VoiceEngine {
  const listeners = new Set<(event: VoiceEngineEvent) => void>();
  const unsubscribed = new Set<string>();
  const emit = (event: VoiceEngineEvent) => {
    for (const listener of listeners) listener(event);
  };
  let capture: CaptureOptions = {
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
  };
  let room: Room | null = null;

  const applySubscription = (participant: RemoteParticipant) => {
    participant
      .getTrackPublication(Track.Source.Microphone)
      ?.setSubscribed(!unsubscribed.has(participant.identity));
  };

  return {
    connect: async (join) => {
      capture = join.capture;
      const next = new Room({ webAudioMix: true, adaptiveStream: false, dynacast: false });
      next.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) =>
        emit({ type: 'speakers', identities: speakers.map(({ identity }) => identity) })
      );
      next.on(RoomEvent.Disconnected, () => emit({ type: 'disconnected' }));
      next.on(RoomEvent.TrackPublished, (_publication, participant) =>
        applySubscription(participant)
      );
      await next.connect(join.url, join.token);
      await next.startAudio();
      room = next;
    },
    disconnect: async () => {
      const closing = room;
      room = null;
      await closing?.disconnect();
    },
    setMicEnabled: async (enabled) => {
      await room?.localParticipant.setMicrophoneEnabled(enabled, enabled ? capture : undefined);
    },
    setCapture: async (next) => {
      capture = next;
      const track = room?.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack;
      await track?.restartTrack(next);
    },
    setVolume: (identity, gain) => {
      room?.remoteParticipants.get(identity)?.setVolume(gain, Track.Source.Microphone);
    },
    setSubscribed: (identity, subscribed) => {
      if (subscribed) unsubscribed.delete(identity);
      else unsubscribed.add(identity);
      const participant = room?.remoteParticipants.get(identity);
      if (participant) applySubscription(participant);
    },
    listDevices: async () => ({
      inputs: toDevices(await Room.getLocalDevices('audioinput')),
      outputs: toDevices(await Room.getLocalDevices('audiooutput')),
      canSelectOutput: 'setSinkId' in HTMLMediaElement.prototype,
    }),
    selectInput: async (deviceId) => {
      await room?.switchActiveDevice('audioinput', deviceId);
    },
    selectOutput: async (deviceId) => {
      await room?.switchActiveDevice('audiooutput', deviceId);
    },
    inputLevel: () => room?.localParticipant.audioLevel ?? 0,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
