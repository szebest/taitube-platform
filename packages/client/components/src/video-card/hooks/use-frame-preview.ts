import { useEffect, useId, useState } from 'react';

const REST_MS = 500;

const PREVIEW_EVENT = 'video-card-preview';

/**
 * A frame preview that starts after the pointer rests `REST_MS` on a card and ends when it leaves, on a
 * scroll, or when another card starts one: the cards tell each other through a document event, so no more
 * than one plays at a time and nothing is held outside the cards.
 */
export function useFramePreview() {
  const id = useId();
  const [state, setState] = useState<'idle' | 'waiting' | 'playing'>('idle');

  useEffect(() => {
    const ignoreOthers = (event: Event) => {
      if (event instanceof CustomEvent && event.detail !== id) setState('idle');
    };
    document.addEventListener(PREVIEW_EVENT, ignoreOthers);
    return () => document.removeEventListener(PREVIEW_EVENT, ignoreOthers);
  }, [id]);

  useEffect(() => {
    if (state === 'idle') return;

    const stop = () => setState('idle');
    const timer =
      state === 'waiting'
        ? window.setTimeout(() => {
            document.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail: id }));
            setState('playing');
          }, REST_MS)
        : undefined;
    window.addEventListener('scroll', stop, { capture: true, passive: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', stop, { capture: true });
    };
  }, [state, id]);

  return {
    playing: state === 'playing',
    wait: () => setState('waiting'),
    cancel: () => setState('idle'),
  };
}
