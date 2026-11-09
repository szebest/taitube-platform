import { useT } from '@vp/intl-react';
import { Drawer } from '@vp/ui';
import type { ReactNode } from 'react';

export interface ShortsCommentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The discussion itself, which a route composes in. */
  children: ReactNode;
}

/** The discussion of a Short, in a sheet over the player. */
export function ShortsCommentSheet({ open, onOpenChange, children }: ShortsCommentSheetProps) {
  const { tOr } = useT();

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Content size="lg" aria-describedby={undefined}>
        <Drawer.Handle />
        <Drawer.Title className="sr-only">{tOr('watch.discussion', {}, '')}</Drawer.Title>
        <Drawer.Body>{children}</Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  );
}
