import type { CaptionTrackView } from '@vp/api-contracts';
import { PLAYBACK_SETTINGS } from '@vp/domain/settings';
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useBrowserLanguages } from '../hooks/use-browser-languages';
import { pickCaptionTrack } from '../playback-defaults';
import type {
  PlayerCaptionStyle,
  PlayerCaptionTrack,
  PlayerCommands,
  PlayerState,
} from '../player-port';
import type { PlaybackDefaults } from '../taitube-player-props';

type CaptionsState = Pick<
  PlayerState,
  'captionTracks' | 'activeCaptionTrack' | 'captionsEnabled' | 'captionCues' | 'captionStyle'
>;

type CaptionsCommands = Pick<
  PlayerCommands,
  'selectCaptionTrack' | 'toggleCaptions' | 'setCaptionStyle'
>;

export interface Captions {
  state: CaptionsState;
  commands: CaptionsCommands;
}

const NO_TRACKS: readonly PlayerCaptionTrack[] = [];

const noop = () => undefined;

export const CaptionsContext = createContext<Captions>({
  state: {
    captionTracks: NO_TRACKS,
    activeCaptionTrack: null,
    captionsEnabled: false,
    captionCues: '',
    captionStyle: {
      size: PLAYBACK_SETTINGS.captionsSize.default,
      background: PLAYBACK_SETTINGS.captionsBackground.default,
    },
  },
  commands: { selectCaptionTrack: noop, toggleCaptions: noop, setCaptionStyle: noop },
});

export function useCaptionsContext(): Captions {
  return useContext(CaptionsContext);
}

function toPlayerTracks(tracks: readonly CaptionTrackView[]): readonly PlayerCaptionTrack[] {
  return tracks.flatMap(({ id, language, kind, status, url }) =>
    status === 'ready' && url !== null ? [{ id, language, kind, src: url }] : []
  );
}

const isCaptionTrack = ({ kind }: TextTrack) => kind === 'captions' || kind === 'subtitles';

function findTextTrack(video: HTMLVideoElement, id: string): TextTrack | undefined {
  return [...video.textTracks].find((track) => track.id === id);
}

const cueText = (cue: TextTrackCue) =>
  cue instanceof VTTCue ? (cue.getCueAsHTML().textContent ?? '') : '';

function readCues(video: HTMLVideoElement | null, id: string | undefined): string {
  if (!video || id === undefined) {
    return '';
  }

  const cues = findTextTrack(video, id)?.activeCues;
  return cues ? Array.from(cues, cueText).join('\n') : '';
}

/** Follows the cues of track `id`, which may only be added after the subscription. */
function subscribeCues(video: HTMLVideoElement, id: string, listener: () => void) {
  let watched: TextTrack | undefined;
  const watch = () => {
    watched?.removeEventListener('cuechange', listener);
    watched = findTextTrack(video, id);
    watched?.addEventListener('cuechange', listener);
    listener();
  };
  watch();
  video.textTracks.addEventListener('addtrack', watch);

  return () => {
    video.textTracks.removeEventListener('addtrack', watch);
    watched?.removeEventListener('cuechange', listener);
  };
}

/** What the viewer picked for one video; `chosen` is `null` until they pick, so the defaults decide. */
interface ViewerChoice {
  playbackUrl: string;
  chosen: { id: string | null } | null;
  lastShown: string | null;
}

const noChoice = (playbackUrl: string): ViewerChoice => ({
  playbackUrl,
  chosen: null,
  lastShown: null,
});

/**
 * The captions of the playing video: the ready tracks side-loaded as `<track>` elements, the one shown
 * kept `hidden` so the browser loads its cues and the skin draws them, and the rest `disabled`.
 */
export function useCaptions(
  video: HTMLVideoElement | null,
  playbackUrl: string,
  tracks: readonly CaptionTrackView[] | undefined,
  defaults: PlaybackDefaults | undefined
): Captions {
  const [choice, setChoice] = useState<ViewerChoice>(() => noChoice(playbackUrl));
  const [styleChoice, setStyleChoice] = useState<Partial<PlayerCaptionStyle>>({});

  const browserLanguages = useBrowserLanguages();

  const { chosen, lastShown } = choice.playbackUrl === playbackUrl ? choice : noChoice(playbackUrl);

  const captionTracks = tracks ? toPlayerTracks(tracks) : NO_TRACKS;
  const picked = pickCaptionTrack(
    captionTracks,
    defaults?.captionsLanguage ?? null,
    browserLanguages
  );
  const startsShowing = defaults?.captionsOn === true ? (picked ?? null) : null;
  const activeCaptionTrack = chosen
    ? (captionTracks.find(({ id }) => id === chosen.id) ?? null)
    : startsShowing;
  const activeId = activeCaptionTrack?.id;
  const captionStyle: PlayerCaptionStyle = {
    size: styleChoice.size ?? defaults?.captionsSize ?? PLAYBACK_SETTINGS.captionsSize.default,
    background:
      styleChoice.background ??
      defaults?.captionsBackground ??
      PLAYBACK_SETTINGS.captionsBackground.default,
  };

  const subscribeToCues = (listener: () => void) =>
    video && activeId !== undefined ? subscribeCues(video, activeId, listener) : noop;
  const captionCues = useSyncExternalStore(
    subscribeToCues,
    () => readCues(video, activeId),
    () => ''
  );

  useEffect(() => {
    if (!video) {
      return;
    }

    const { textTracks } = video;
    const applyModes = () => {
      for (const track of [...textTracks].filter(isCaptionTrack)) {
        track.mode = track.id === activeId ? 'hidden' : 'disabled';
      }
    };
    applyModes();
    textTracks.addEventListener('addtrack', applyModes);

    return () => textTracks.removeEventListener('addtrack', applyModes);
  }, [video, activeId]);

  const selectCaptionTrack = (id: string | null) =>
    setChoice({ playbackUrl, chosen: { id }, lastShown: id ?? lastShown });

  const toggleCaptions = () => {
    if (activeCaptionTrack) {
      setChoice({ playbackUrl, chosen: { id: null }, lastShown: activeCaptionTrack.id });
      return;
    }

    const next = captionTracks.find(({ id }) => id === lastShown) ?? picked;
    if (next) {
      selectCaptionTrack(next.id);
    }
  };

  return {
    state: {
      captionTracks,
      activeCaptionTrack,
      captionsEnabled: activeCaptionTrack !== null,
      captionCues,
      captionStyle,
    },
    commands: {
      selectCaptionTrack,
      toggleCaptions,
      setCaptionStyle: (style) => setStyleChoice((current) => ({ ...current, ...style })),
    },
  };
}
