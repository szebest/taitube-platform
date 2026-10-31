import { Button, DropdownMenu, Icon, IconButton, useUiCopy } from '@vp/ui';
import type { ReactNode } from 'react';
import { useVideoCard } from './video-card.context';
import { videoCardStyles } from './video-card.variants';

export interface VideoCardActionsProps {
  onSave?: () => void;
  onQueue?: () => void;
}

export interface VideoCardMenuProps extends VideoCardActionsProps {
  className?: string;
  /** More `DropdownMenu.Item`s, after Save and Queue. */
  children?: ReactNode;
}

/** The card's actions behind one button, shown on hover and focus, always on touch; nothing when there are none. */
export function VideoCardMenu({ onSave, onQueue, className, children }: VideoCardMenuProps) {
  const shared = useVideoCard('Menu');
  const copy = useUiCopy();

  if (onSave === undefined && onQueue === undefined && children === undefined) {
    return null;
  }

  return (
    <div data-slot="video-card-menu" className={videoCardStyles(shared).menu({ className })}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton aria-label={copy.moreActions} size="sm">
            <Icon name="more" />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          {onSave !== undefined && (
            <DropdownMenu.Item onSelect={onSave}>
              <Icon name="save" />
              {copy.save}
            </DropdownMenu.Item>
          )}
          {onQueue !== undefined && (
            <DropdownMenu.Item onSelect={onQueue}>
              <Icon name="playlist" />
              {copy.queue}
            </DropdownMenu.Item>
          )}
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}

export interface VideoCardExpandedProps extends VideoCardActionsProps {
  className?: string;
  /** The description, cut to two lines. */
  children?: ReactNode;
}

/**
 * The raised panel a resting mouse opens: the description and Save and Queue. It is no tab stop and
 * hidden from assistive technology, since the menu holds the same actions.
 */
export function VideoCardExpanded({
  onSave,
  onQueue,
  className,
  children,
}: VideoCardExpandedProps) {
  const shared = useVideoCard('Expanded');
  const copy = useUiCopy();
  const styles = videoCardStyles(shared);

  if (!shared.expanded) {
    return null;
  }

  return (
    <div data-slot="video-card-expanded" aria-hidden="true" className={styles.panel({ className })}>
      {children !== undefined && <p className={styles.description()}>{children}</p>}
      <div className={styles.actions()}>
        {onSave !== undefined && (
          <Button tabIndex={-1} size="sm" variant="soft" onClick={onSave}>
            <Icon name="save" />
            {copy.save}
          </Button>
        )}
        {onQueue !== undefined && (
          <Button tabIndex={-1} size="sm" variant="soft" onClick={onQueue}>
            <Icon name="playlist" />
            {copy.queue}
          </Button>
        )}
      </div>
    </div>
  );
}
