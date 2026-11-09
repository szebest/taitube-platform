import { usePlayerState } from '#app/integrations/video-js/video-js-engine';
import type { PlayerCaptionStyle } from '#app/lib/player/player-port';

const SIZE_CLASSES: Record<PlayerCaptionStyle['size'], string> = {
  small: 'text-body-sm',
  medium: 'text-body',
  large: 'text-title',
  xlarge: 'text-title-lg',
};

const BACKGROUND_CLASSES: Record<PlayerCaptionStyle['background'], string> = {
  none: '[text-shadow:0_0_0.25em_var(--media)]',
  translucent: 'bg-media/70',
  solid: 'bg-media',
};

/** The cues at the playhead, drawn from the port state so their size and background look the same in every browser. */
export function CaptionOverlay() {
  const cues = usePlayerState((state) => state.captionCues);
  const { size, background } = usePlayerState((state) => state.captionStyle);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center px-6">
      {cues !== '' && (
        <p
          data-caption-size={size}
          data-caption-background={background}
          className={`m-0 max-w-[80%] rounded-control px-2 py-1 text-center whitespace-pre-line text-on-media ${SIZE_CLASSES[size]} ${BACKGROUND_CLASSES[background]}`}
        >
          {cues}
        </p>
      )}
    </div>
  );
}
