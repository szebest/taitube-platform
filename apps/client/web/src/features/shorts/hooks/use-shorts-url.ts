import { ignoreRejection } from '@kit/result';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useEffectEvent, useRef } from 'react';

const MIRROR_DELAY_MS = 200;

interface ShortsUrlOptions {
  /** The Short on screen. */
  activeId: string | undefined;
  /** The Short the URL names. */
  named: string | undefined;
  /** The URL was sent to another Short from outside the feed. */
  onExternal: (id: string) => void;
}

/**
 * Keeps the URL naming the Short on screen once the feed has rested on it, replacing the entry so Back
 * leaves the player, and tells the feed when something else sent the URL to another Short. The router
 * renders a navigation well after the address changed, so `named` can lag the address: both the write and
 * the reading of a rendered Short go by the address the router is heading to.
 */
export function useShortsUrl({ activeId, named, onExternal }: ShortsUrlOptions) {
  const router = useRouter();
  const written = useRef<string | undefined>(undefined);

  const isHeadingTo = (id: string) =>
    router.buildLocation({ to: '/shorts/$videoId', params: { videoId: id } }).pathname ===
    router.latestLocation.pathname;

  const mirror = useEffectEvent((id: string) => {
    if (isHeadingTo(id)) {
      return;
    }

    written.current = id;
    ignoreRejection(
      router.navigate({ to: '/shorts/$videoId', params: { videoId: id }, replace: true }),
      'a refused navigation leaves the viewer where they are'
    );
  });

  const follow = useEffectEvent((id: string) => {
    if (!isHeadingTo(id)) {
      return;
    }

    const own = id === written.current;
    written.current = undefined;
    if (own || id === activeId) {
      return;
    }

    onExternal(id);
  });

  useEffect(() => {
    if (activeId === undefined) {
      return;
    }

    const timer = window.setTimeout(() => mirror(activeId), MIRROR_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeId]);

  useEffect(() => {
    if (named !== undefined) {
      follow(named);
    }
  }, [named]);
}
