import { ResponsiveModal } from '@kit/ui';
import { type ReactNode, useState } from 'react';
import { useRequireAccount } from '#app/hooks/use-require-account';
import type { WatchTogetherSource } from './types';
import { WatchTogetherContext } from './watch-together.context';
import { LazyWatchTogetherContent } from './watch-together.lazy';

export interface WatchTogetherRootProps {
  /** Read when the dialog opens, so a video's playhead is the moment it opens at. */
  source: () => WatchTogetherSource;
  /** Where the dialog portals: the player's fullscreen element, so it shows there. */
  container?: HTMLElement | null;
  children: ReactNode;
}

/**
 * "Watch together": a trigger, and the dialog its click opens with the room already made. A guest
 * is asked to sign in instead. The dialog's code loads on the first open.
 */
export function WatchTogetherRoot({ source, container, children }: WatchTogetherRootProps) {
  const { run } = useRequireAccount('party');
  const [opened, setOpened] = useState<WatchTogetherSource>();
  const [open, setOpen] = useState(false);
  const [withStart, setWithStart] = useState(true);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setOpen(false);
      return;
    }
    run(() => {
      setOpened(source());
      setWithStart(true);
      setOpen(true);
    });
  };

  return (
    <ResponsiveModal.Root open={open} onOpenChange={handleOpenChange}>
      {children}
      {opened && (
        <WatchTogetherContext value={{ source: opened, withStart, setWithStart, container }}>
          <LazyWatchTogetherContent />
        </WatchTogetherContext>
      )}
    </ResponsiveModal.Root>
  );
}

/** The element that starts it, drawn as the caller's own button: its click makes the room and opens the dialog. */
export function WatchTogetherTrigger({ children }: { children: ReactNode }) {
  return <ResponsiveModal.Trigger asChild>{children}</ResponsiveModal.Trigger>;
}
