import { useT } from '@vp/intl-react';
import { PartyCan } from '@vp/permissions-react';
import { Button, Icon, IconButton } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';

/** The Queue tab: what plays next, in the room's order. */
export function PartyQueueRoot({ className, ...props }: ComponentPropsWithRef<'section'>) {
  const { tOr } = useT();

  return (
    <section
      data-slot="party-queue"
      aria-label={tOr('party.tabsQueue', {}, '')}
      className={`flex min-h-0 flex-col gap-stack overflow-y-auto p-inset-card ${className ?? ''}`}
      {...props}
    />
  );
}

export function PartyQueueList({ className, ...props }: ComponentPropsWithRef<'ol'>) {
  return (
    <ol className={`m-0 flex list-none flex-col gap-stack p-0 ${className ?? ''}`} {...props} />
  );
}

export interface PartyQueueItemProps extends ComponentPropsWithRef<'li'> {
  title: string;
  thumbnailUrl?: string | null;
  addedBy: string;
  current?: boolean;
  onRemove?: () => void;
}

export function PartyQueueItem({
  title,
  thumbnailUrl,
  addedBy,
  current = false,
  onRemove,
  className,
  ...props
}: PartyQueueItemProps) {
  const { tOr } = useT();

  return (
    <li
      data-slot="party-queue-item"
      aria-current={current || undefined}
      className={`flex items-center gap-inline rounded-control data-[current=true]:bg-tint ${className ?? ''}`}
      data-current={current}
      {...props}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          className="aspect-video w-20 shrink-0 rounded-thumb object-cover"
        />
      ) : (
        <span aria-hidden="true" className="aspect-video w-20 shrink-0 rounded-thumb bg-tint" />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-label">{title}</span>
        <span className="truncate text-caption text-fg-muted">
          {current
            ? tOr('party.phasePlaying', {}, '')
            : tOr('party.queueAddedBy', { name: addedBy }, '')}
        </span>
      </span>
      {onRemove && (
        <PartyCan gate={{ permission: 'queue.remove' }}>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={tOr('party.queueRemove', { title }, '')}
            onClick={onRemove}
          >
            <Icon name="close" />
          </IconButton>
        </PartyCan>
      )}
    </li>
  );
}

export function PartyQueueEmpty() {
  const { tOr } = useT();

  return (
    <p data-slot="party-queue-empty" className="m-0 text-body-sm text-fg-muted">
      {tOr('party.queueEmpty', {}, '')}
    </p>
  );
}

/** Only where the viewer holds `queue.add`. */
export function PartyQueueAdd({ onAdd }: { onAdd: () => void }) {
  const { tOr } = useT();

  return (
    <PartyCan gate={{ permission: 'queue.add' }}>
      <Button size="sm" variant="soft" onClick={onAdd}>
        <Icon name="queue-add" size="sm" />
        {tOr('party.queueAdd', {}, '')}
      </Button>
    </PartyCan>
  );
}
