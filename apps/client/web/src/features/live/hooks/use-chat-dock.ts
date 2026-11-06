import { useEffect, useState } from 'react';

import type { LiveChatLayout } from '#app/components/live/live-chat';

function createChatHost(): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const host = document.createElement('div');
  host.className = 'tw:contents';
  return host;
}

/**
 * One element for the chat to render into through a portal, moved between the docked slot and the
 * player's overlay slot: the chat stays mounted across a fullscreen or orientation change, so its
 * socket, lines, scroll and opacity survive it. On the server there is no element.
 */
export function useChatDock(place: LiveChatLayout) {
  const [host] = useState(createChatHost);
  const [docked, setDocked] = useState<HTMLElement | null>(null);
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const slot = place === 'overlay' ? overlay : docked;
    if (host && slot) {
      slot.append(host);
    }
  }, [host, place, docked, overlay]);

  return { host, dockedRef: setDocked, overlayRef: setOverlay };
}
