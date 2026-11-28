export interface CaptureOptions {
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}

export interface VoiceDevice {
  id: string;
  label: string;
}

export interface VoiceDevices {
  inputs: readonly VoiceDevice[];
  outputs: readonly VoiceDevice[];
  canSelectOutput: boolean;
}

export type VoiceEngineEvent =
  | { type: 'speakers'; identities: readonly string[] }
  | { type: 'disconnected' };

type VoiceEngineListener = (event: VoiceEngineEvent) => void;

/** What the voice UI needs from a media client; `livekit-engine.ts` is the one module that talks to LiveKit. */
export interface VoiceEngine {
  connect(join: {
    url: string;
    token: string;
    publish: boolean;
    capture: CaptureOptions;
  }): Promise<void>;
  disconnect(): Promise<void>;
  setMicEnabled(enabled: boolean): Promise<void>;
  setCapture(capture: CaptureOptions): Promise<void>;
  setVolume(identity: string, gain: number): void;
  setSubscribed(identity: string, subscribed: boolean): void;
  listDevices(): Promise<VoiceDevices>;
  selectInput(deviceId: string): Promise<void>;
  selectOutput(deviceId: string): Promise<void>;
  inputLevel(): number;
  subscribe(listener: VoiceEngineListener): () => void;
}

const VOLUME_PERCENT = { min: 0, max: 200 } as const;

type VoicePhase = 'idle' | 'connecting' | 'live' | 'dropped';

export interface VoiceSnapshot {
  phase: VoicePhase;
  canSpeak: boolean;
  pushToTalk: boolean;
  held: boolean;
  selfMuted: boolean;
  micPaused: boolean;
  micOn: boolean;
  speaking: readonly string[];
  audible: readonly string[];
}

export const VOICE_IDLE: VoiceSnapshot = {
  phase: 'idle',
  canSpeak: false,
  pushToTalk: false,
  held: false,
  selfMuted: false,
  micPaused: false,
  micOn: false,
  speaking: [],
  audible: [],
};

export interface VoiceSession {
  getSnapshot(): VoiceSnapshot;
  subscribe(listener: () => void): () => void;
  join(grant: { url: string; token: string; canSpeak: boolean }): Promise<void>;
  leave(): Promise<void>;
  setPushToTalk(pushToTalk: boolean): void;
  hold(held: boolean): void;
  setSelfMuted(selfMuted: boolean): void;
  setPageHidden(hidden: boolean): void;
  resumeMic(): void;
  setCapture(capture: CaptureOptions): Promise<void>;
  setMemberVolume(identity: string, percent: number): void;
  setMemberMuted(identity: string, muted: boolean): void;
  engine: VoiceEngine;
}

interface VoiceSessionOptions {
  engine: VoiceEngine;
  selfIdentity: string;
  pushToTalk: boolean;
  capture: CaptureOptions;
  onSelfMuteChange(muted: boolean): void;
}

function clampPercent(percent: number): number {
  return Math.min(VOLUME_PERCENT.max, Math.max(VOLUME_PERCENT.min, percent));
}

/** One viewer's voice connection over an engine: who is audible, whose volume is changed, and when the microphone is on. */
export function createVoiceSession({
  engine,
  selfIdentity,
  pushToTalk,
  capture,
  onSelfMuteChange,
}: VoiceSessionOptions): VoiceSession {
  let snapshot: VoiceSnapshot = { ...VOICE_IDLE, pushToTalk };
  let capturing = capture;
  const mutedForMe = new Set<string>();
  const listeners = new Set<() => void>();
  let stopEvents: (() => void) | undefined;

  const wantsMic = (state: VoiceSnapshot) =>
    state.phase === 'live' &&
    state.canSpeak &&
    !state.selfMuted &&
    !state.micPaused &&
    (!state.pushToTalk || state.held);

  const audibleOf = (speaking: readonly string[]) =>
    speaking.filter((identity) => identity !== selfIdentity && !mutedForMe.has(identity));

  const update = (change: Partial<VoiceSnapshot>) => {
    const before = snapshot;
    const merged = { ...before, ...change };
    snapshot = { ...merged, micOn: wantsMic(merged), audible: audibleOf(merged.speaking) };
    if (snapshot.micOn !== before.micOn) {
      void engine.setMicEnabled(snapshot.micOn);
    }
    for (const listener of listeners) listener();
  };

  const handleEvent: VoiceEngineListener = (event) => {
    if (event.type === 'speakers') {
      update({ speaking: event.identities });
      return;
    }
    update({ phase: 'dropped', speaking: [] });
  };

  return {
    engine,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    join: async ({ url, token, canSpeak }) => {
      stopEvents?.();
      stopEvents = engine.subscribe(handleEvent);
      update({ phase: 'connecting', canSpeak, speaking: [] });
      await engine.connect({ url, token, publish: canSpeak, capture: capturing });
      update({ phase: 'live' });
    },
    leave: async () => {
      stopEvents?.();
      stopEvents = undefined;
      await engine.disconnect();
      update({ ...VOICE_IDLE, pushToTalk: snapshot.pushToTalk, selfMuted: snapshot.selfMuted });
    },
    setPushToTalk: (next) => update({ pushToTalk: next, held: false }),
    hold: (held) => update({ held }),
    setSelfMuted: (selfMuted) => {
      update({ selfMuted });
      onSelfMuteChange(selfMuted);
    },
    setPageHidden: (hidden) => {
      if (hidden && snapshot.canSpeak && snapshot.micOn) {
        update({ micPaused: true });
      }
    },
    resumeMic: () => update({ micPaused: false }),
    setCapture: (next) => {
      capturing = next;
      return engine.setCapture(next);
    },
    setMemberVolume: (identity, percent) => engine.setVolume(identity, clampPercent(percent) / 100),
    setMemberMuted: (identity, muted) => {
      if (muted) mutedForMe.add(identity);
      else mutedForMe.delete(identity);
      engine.setSubscribed(identity, !muted);
      update({});
    },
  };
}
