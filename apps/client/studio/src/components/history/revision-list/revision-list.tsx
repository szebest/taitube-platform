import { Format } from '@kit/intl-react';
import { Badge, Button, cn } from '@kit/ui';
import type { VideoMetadataField } from '@vp/domain';
import { publishedAt } from '@vp/intl-formats';
import type { ComponentPropsWithRef } from 'react';
import { useT } from '#app/lib/messages';

export interface RevisionListItem {
  id: string;
  version: number;
  createdAt: string;
  /** The version a restore went back to; `null` for an ordinary edit. */
  restoredFromVersion: number | null;
  /** The fields that differ from the version before; `null` for the oldest one. */
  changedFields: VideoMetadataField[] | null;
  current: boolean;
}

export interface RevisionListProps extends Omit<ComponentPropsWithRef<'ol'>, 'children'> {
  items: readonly RevisionListItem[];
  onRestore: (item: RevisionListItem) => void;
  /** Every restore waits while one runs, so a second click cannot start a second one. */
  pending?: boolean;
}

/** The versions of one record, newest first, each with what it changed and a way back to it. */
export function RevisionList({
  items,
  onRestore,
  pending = false,
  className,
  ...props
}: RevisionListProps) {
  const { tOr } = useT();

  return (
    <ol
      data-slot="revision-list"
      className={cn('m-0 flex list-none flex-col gap-stack p-0', className)}
      {...props}
    >
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-inline">
          <div className="flex flex-col gap-inline">
            <span className="flex items-center gap-inline">
              <strong>{tOr('studio.historyVersion', { version: item.version }, '')}</strong>
              {item.current && <Badge size="sm">{tOr('studio.historyCurrent', {}, '')}</Badge>}
              <time className="text-caption text-fg-muted" dateTime={item.createdAt}>
                <Format value={publishedAt(item.createdAt).relative} />
              </time>
            </span>
            {item.restoredFromVersion !== null && (
              <span className="text-caption text-fg-muted">
                {tOr('studio.historyRestoredFrom', { version: item.restoredFromVersion }, '')}
              </span>
            )}
            <span className="text-caption text-fg-muted">
              {item.changedFields === null
                ? tOr('studio.historyOriginal', {}, '')
                : item.changedFields.length === 0
                  ? tOr('studio.historyNoChange', {}, '')
                  : tOr(
                      'studio.historyChanged',
                      {
                        fields: item.changedFields.map((field) =>
                          tOr('studio.historyField', { field }, field)
                        ),
                      },
                      ''
                    )}
            </span>
          </div>
          {!item.current && (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => onRestore(item)}>
              {tOr('studio.historyRestore', { version: item.version }, '')}
            </Button>
          )}
        </li>
      ))}
    </ol>
  );
}
