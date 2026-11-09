import { useEffect, useEffectEvent } from 'react';
import { usePlayerCommands, usePlayerContainer } from '#app/integrations/video-js/video-js-engine';
import type { PlayerCommands } from '#app/lib/player/player-port';

const HOTKEYS: Readonly<Record<string, (commands: PlayerCommands) => void>> = {
  c: ({ toggleCaptions }) => toggleCaptions(),
};

const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function isEditing(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(EDITABLE) !== null;
}

function hasModifier({ altKey, ctrlKey, metaKey }: KeyboardEvent): boolean {
  return altKey || ctrlKey || metaKey;
}

/** The player's keyboard shortcuts, heard with focus on the page itself or inside the player, never while typing. */
export function PlayerHotkeys() {
  const container = usePlayerContainer();
  const commands = usePlayerCommands();

  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    const { target } = event;
    const inPlayer =
      target === document.body || (target instanceof Node && container?.contains(target));
    if (!inPlayer || event.defaultPrevented || hasModifier(event) || isEditing(target)) {
      return;
    }

    const hotkey = HOTKEYS[event.key.toLowerCase()];
    if (!hotkey) {
      return;
    }

    event.preventDefault();
    hotkey(commands);
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleKey(event);
    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}
