import type { VideoSummary } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useMediaQuery, useUiCopy, VisuallyHidden } from '@vp/ui';
import { type KeyboardEvent, type ReactNode, useEffect, useRef } from 'react';
import { useShortsPlayback } from '#app/features/shorts/hooks/use-shorts-playback';
import { useShortsScroll } from '#app/features/shorts/hooks/use-shorts-scroll';
import { useShortsUrl } from '#app/features/shorts/hooks/use-shorts-url';
import { ownsKeystrokes } from '#app/features/shorts/utils/owns-keystrokes';
import { useReaction } from '#app/hooks/use-reaction';
import { ShortsSlide } from '../shorts-slide/shorts-slide';

const ACTIONS_BESIDE = '(min-width: 600px)';
const LOAD_MORE_WITHIN = 3;
const PRELOAD_AHEAD = 2;

export interface ShortsFeedProps {
  shorts: readonly VideoSummary[];
  /** The Short the URL named when the feed opened. */
  named: string | undefined;
  hasMore: boolean;
  loadMore: () => void;
  /** The discussion of a Short, which a route composes in. */
  renderComments: (videoId: string) => ReactNode;
}

/**
 * The Shorts feed: a vertical scroller that snaps to one Short at a time, so touch, wheel and trackpad
 * move it natively, and the keys move it too. It takes focus when it opens, so the keys work at once.
 */
export function ShortsFeed({ shorts, named, hasMore, loadMore, renderComments }: ShortsFeedProps) {
  const { tOr } = useT();
  const { shortsPlayer } = useUiCopy();
  const beside = useMediaQuery(ACTIONS_BESIDE);
  const playback = useShortsPlayback();
  const feed = useRef<HTMLElement>(null);

  const initial = Math.max(
    shorts.findIndex(({ id }) => id === named),
    0
  );
  const { index, attach, goTo, handlers } = useShortsScroll({
    count: shorts.length,
    initialIndex: initial,
    onIndexChange: (next) => {
      playback.startOver();
      if (hasMore && next >= shorts.length - LOAD_MORE_WITHIN) {
        loadMore();
      }
    },
  });
  const active = shorts[index];
  const { reaction, change } = useReaction(active?.id ?? '');

  useShortsUrl({
    activeId: active?.id,
    named,
    onExternal: (id) => goTo(shorts.findIndex((short) => short.id === id)),
  });

  useEffect(() => {
    feed.current?.focus({ preventScroll: true });
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const { currentTarget, target, key, metaKey, ctrlKey, altKey } = event;
    if (
      event.defaultPrevented ||
      metaKey ||
      ctrlKey ||
      altKey ||
      !currentTarget.contains(target as Node) ||
      ownsKeystrokes(target)
    ) {
      return;
    }

    const moves: Record<string, () => void> = {
      arrowdown: () => goTo(index + 1),
      j: () => goTo(index + 1),
      arrowup: () => goTo(index - 1),
      k: () => goTo(index - 1),
      m: playback.toggleMute,
      c: playback.toggleCaptions,
      l: () => change(reaction === 'LIKE' ? null : 'LIKE'),
    };
    const press = target instanceof HTMLButtonElement ? undefined : playback.togglePlay;
    const act = key === ' ' ? press : moves[key.toLowerCase()];
    if (!act) {
      return;
    }

    act();
    event.preventDefault();
  };

  const ended = !hasMore && index === shorts.length - 1;
  const title = active?.title ?? tOr('browse.untitled', {}, '');
  const channel = active?.channel?.displayName ?? '';

  return (
    <section
      ref={(node) => {
        feed.current = node;
        attach(node);
      }}
      data-slot="shorts-feed"
      aria-label={shortsPlayer}
      tabIndex={-1}
      className="h-[calc(100dvh-var(--layout-header)-3.5rem-env(safe-area-inset-bottom))] touch-pan-y snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] outline-none medium:h-[calc(100dvh-var(--layout-header))]"
      onKeyDown={handleKeyDown}
      {...handlers}
    >
      {shorts
        .slice(index + 1, index + 1 + PRELOAD_AHEAD)
        .map(
          ({ id, posterUrl }) =>
            posterUrl && <link key={id} rel="preload" as="image" href={posterUrl} />
        )}
      {shorts.map((short, position) => (
        <ShortsSlide
          key={short.id}
          short={short}
          distance={position - index}
          layout={beside ? 'beside' : 'overlay'}
          ended={ended}
          playback={playback}
          onPrevious={index > 0 ? () => goTo(index - 1) : undefined}
          onNext={index < shorts.length - 1 ? () => goTo(index + 1) : undefined}
          renderComments={renderComments}
        />
      ))}
      <VisuallyHidden role="status">
        {tOr('shorts.announce', { title, channel }, '')}
      </VisuallyHidden>
    </section>
  );
}
