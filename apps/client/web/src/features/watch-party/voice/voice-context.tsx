import { isOk } from '@kit/result';
import { type ErrorCode } from '@vp/errors';
import { useApi, type WatchPartySocket } from '@vp/queries';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { usePlayerSeek } from '#app/components/player/taitube-player';
import { loadVoiceEngine } from './load-voice-engine';
import { isPushToTalkKey } from './push-to-talk-key';
import { requestVoiceGrant } from './request-voice-grant';
import { useVoiceSettings } from './use-voice-settings';
import { type Ducker, createDucker } from './voice-ducking';
import {
  type CaptureOptions,
  VOICE_IDLE,
  type VoiceSession,
  type VoiceSnapshot,
  createVoiceSession,
} from './voice-port';

export interface VoiceContextValue {
  snapshot: VoiceSnapshot;
  session: VoiceSession | null;
  joining: boolean;
  speakersFull: boolean;
  failure: ErrorCode | null;
  pushToTalkLocked: boolean;
  noiseSuppression: boolean;
  settings: ReturnType<typeof useVoiceSettings>;
  join(): Promise<void>;
  leave(): Promise<void>;
  requestToSpeak(): void;
  setSelfMuted(muted: boolean): void;
  setPushToTalk(pushToTalk: boolean): void;
  setNoiseSuppression(enabled: boolean): void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

/** The room's voice, or `null` when the room has none: every voice part then draws nothing. */
export function useVoice(): VoiceContextValue | null {
  return useContext(VoiceContext);
}

function captureOf(noiseSuppression: boolean): CaptureOptions {
  return { noiseSuppression, echoCancellation: true, autoGainControl: true };
}

const NO_SUBSCRIPTION = () => () => undefined;

function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

interface VoiceProviderProps extends PropsWithChildren {
  roomId: string;
  selfKey: string;
  roomMode: 'open' | 'push_to_talk';
  send: WatchPartySocket['send'];
}

/** Joins the room's voice on a tap and keeps its session, ducking, push-to-talk key and background rules. */
export function VoiceProvider({ roomId, selfKey, roomMode, send, children }: VoiceProviderProps) {
  const api = useApi();
  const channel = usePlayerSeek();
  const settings = useVoiceSettings();
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [joining, setJoining] = useState(false);
  const [speakersFull, setSpeakersFull] = useState(false);
  const [failure, setFailure] = useState<ErrorCode | null>(null);

  const pushToTalkLocked = roomMode === 'push_to_talk';
  const pushToTalk = pushToTalkLocked || settings.pushToTalk;
  const snapshot = useSyncExternalStore(
    session?.subscribe ?? NO_SUBSCRIPTION,
    session?.getSnapshot ?? (() => VOICE_IDLE),
    () => VOICE_IDLE
  );

  const join = async () => {
    setJoining(true);
    setFailure(null);
    const granted = await requestVoiceGrant(api, roomId);
    if (!isOk(granted)) {
      setFailure(granted.error);
      setJoining(false);
      return;
    }
    const grant = granted.value;
    setSpeakersFull(grant.speakersFull);
    const current =
      session ??
      createVoiceSession({
        engine: await loadVoiceEngine(),
        selfIdentity: selfKey,
        pushToTalk,
        capture: captureOf(settings.noiseSuppression),
        onSelfMuteChange: (muted) => send({ type: 'voice.mute', muted }),
      });
    setSession(current);
    await current.join(grant);
    setJoining(false);
  };

  const leave = async () => {
    await session?.leave();
    setSession(null);
    setSpeakersFull(false);
  };

  useEffect(() => session?.setPushToTalk(pushToTalk), [session, pushToTalk]);

  const audible = snapshot.audible.length > 0 && settings.duck.enabled;
  const duckLevel = useRef(settings.duck.level);
  const ducker = useRef<Ducker | null>(null);
  useEffect(() => {
    duckLevel.current = settings.duck.level;
  });
  useEffect(() => {
    const created = createDucker(channel, () => duckLevel.current);
    ducker.current = created;
    return () => {
      created.dispose();
      ducker.current = null;
    };
  }, [channel]);
  useEffect(() => ducker.current?.setAudible(audible), [audible]);

  const hold = useEffectEvent((held: boolean) => session?.hold(held));
  useEffect(() => {
    if (!snapshot.pushToTalk || snapshot.phase !== 'live') {
      return;
    }
    const down = (event: KeyboardEvent) => {
      if (isPushToTalkKey(event)) {
        event.preventDefault();
        hold(true);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'v') hold(false);
    };
    const release = () => hold(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
    };
  }, [snapshot.pushToTalk, snapshot.phase]);

  const rejoin = useEffectEvent(() => void join());
  useEffect(() => {
    if (!session || !isTouchDevice()) {
      return;
    }
    const onVisibility = () => {
      session.setPageHidden(document.hidden);
      if (!document.hidden && session.getSnapshot().phase === 'dropped') rejoin();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [session]);

  useEffect(
    () => () => {
      void session?.leave();
    },
    [session]
  );

  const value: VoiceContextValue = {
    snapshot,
    session,
    joining,
    speakersFull,
    failure,
    pushToTalkLocked,
    noiseSuppression: settings.noiseSuppression,
    settings,
    join,
    leave,
    requestToSpeak: () => send({ type: 'request', kind: 'speak' }),
    setSelfMuted: (muted) => session?.setSelfMuted(muted),
    setPushToTalk: settings.setPushToTalk,
    setNoiseSuppression: (enabled) => {
      settings.setNoiseSuppression(enabled);
      void session?.setCapture(captureOf(enabled));
    },
  };

  return <VoiceContext value={value}>{children}</VoiceContext>;
}
