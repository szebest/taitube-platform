import { useFormat, useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';
import type { PlayerCaptionTrack } from '../player-port';

/** Names a track by its language in the viewer's locale, saying so when speech-to-text wrote it. */
export function useCaptionTrackLabel(): (
  track: Pick<PlayerCaptionTrack, 'language' | 'kind'>
) => string {
  const { tOr } = useT();
  const { format } = useFormat();

  return ({ language, kind }) => {
    if (language === null) {
      return tOr('player.captionTrackUndetected', {}, '');
    }

    const name = unwrapOr(
      format({ type: 'displayName', value: language, of: 'language' }),
      language
    );
    return kind === 'auto' ? tOr('player.captionTrackAuto', { language: name }, '') : name;
  };
}
