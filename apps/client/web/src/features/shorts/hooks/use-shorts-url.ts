import { useNavigate } from '@tanstack/react-router';
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
 * leaves the player, and tells the feed when something else sent the URL to another Short.
 */
export function useShortsUrl({ activeId, named, onExternal }: ShortsUrlOptions) {
  const navigate = useNavigate();
  const written = useRef(new Set<string>());

  const mirror = useEffectEvent((id: string) => {
    if (id === named) {
      return;
    }

    written.current.add(id);
    navigate({ to: '/shorts/$videoId', params: { videoId: id }, replace: true });
  });

  const follow = useEffectEvent((id: string) => {
    if (written.current.delete(id) || id === activeId) {
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
