import { useEffect, useEffectEvent } from 'react';
import { findDefaultRendition } from '#app/lib/player/playback-defaults';
import type { PlaybackDefaults } from '#app/lib/player/taitube-player-props';
import { usePlayerCommands } from '../hooks/use-player-commands';
import { usePlayerState } from '../hooks/use-player-state';

export function StartAtDefaultQuality({ quality }: Pick<PlaybackDefaults, 'quality'>) {
  const { selectVideoRendition } = usePlayerCommands();
  const renditions = usePlayerState((state) => state.renditions);
  const listed = renditions.length > 0;

  const applyQuality = useEffectEvent(() => {
    const id = findDefaultRendition(renditions, quality);
    if (id !== undefined) {
      selectVideoRendition(id);
    }
  });

  useEffect(() => {
    if (listed) {
      applyQuality();
    }
  }, [listed]);

  return null;
}
