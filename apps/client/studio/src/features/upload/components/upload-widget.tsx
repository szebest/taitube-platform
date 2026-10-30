import { fileSize, uploadProgress } from '@vp/intl';
import { useFormat, useT } from '@vp/intl-react';
import { assertNever, unwrapOr } from '@vp/result';
import { Button, Card, Icon, IconButton, Progress } from '@vp/ui';

import { percentOf } from '../api/upload-progress';
import { type UploadItem, useUploadDock } from '../hooks/upload-dock';
import { useUploadProgress } from '../hooks/use-upload-progress';
import { UploadProcessing } from './upload-processing';

function SendingRow({ id, title }: { id: string; title: string }) {
  const { cancel } = useUploadDock('Widget');
  const progress = useUploadProgress(id);
  const { tOr } = useT();
  const { format } = useFormat();
  const formatted = (value: Parameters<typeof format>[0]) => unwrapOr(format(value), '');

  return (
    <div className="tw:flex tw:flex-col tw:gap-inline">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-inline">
        <span className="tw:text-label">{tOr('studio.uploadSending', { title }, '')}</span>
        <IconButton
          size="sm"
          aria-label={tOr('studio.uploadCancelItem', { title }, '')}
          onClick={() => cancel(id)}
        >
          <Icon name="close" />
        </IconButton>
      </div>
      <Progress
        size="sm"
        aria-label={tOr('studio.uploadSendingLabel', { title }, '')}
        value={progress === undefined ? undefined : percentOf(progress)}
      />
      {progress !== undefined && (
        <p className="tw:text-caption tw:text-fg-muted">
          {tOr(
            'studio.uploadSendingDetail',
            {
              progress: formatted(uploadProgress(percentOf(progress))),
              sent: formatted(fileSize(progress.loaded)),
              total: formatted(fileSize(progress.total)),
            },
            ''
          )}
        </p>
      )}
    </div>
  );
}

function FailedRow({ id, title }: { id: string; title: string }) {
  const { dismiss } = useUploadDock('Widget');
  const { tOr } = useT();

  return (
    <div role="alert" className="tw:flex tw:items-center tw:justify-between tw:gap-inline">
      <span>{tOr('studio.uploadFailed', { title }, '')}</span>
      <Button size="sm" variant="ghost" onClick={() => dismiss(id)}>
        {tOr('studio.uploadDismiss', {}, '')}
      </Button>
    </div>
  );
}

function SentRow({ id, title, videoId }: { id: string; title: string; videoId: string }) {
  const { dismiss } = useUploadDock('Widget');
  const { tOr } = useT();

  return (
    <div className="tw:flex tw:flex-col tw:gap-inline">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-inline">
        <span className="tw:text-label">{title}</span>
        <IconButton
          size="sm"
          aria-label={tOr('studio.uploadDismiss', {}, '')}
          onClick={() => dismiss(id)}
        >
          <Icon name="close" />
        </IconButton>
      </div>
      <UploadProcessing videoId={videoId} title={title} />
    </div>
  );
}

function UploadRow({ item }: { item: UploadItem }) {
  switch (item.kind) {
    case 'sending':
      return <SendingRow id={item.id} title={item.title} />;
    case 'sent':
      return <SentRow id={item.id} title={item.title} videoId={item.videoId} />;
    case 'failed':
      return <FailedRow id={item.id} title={item.title} />;
    default:
      return assertNever(item, 'UploadItem');
  }
}

/** The uploads in flight and their processing, over every page of the studio. */
export function UploadWidget() {
  const { items } = useUploadDock('Widget');
  const { tOr } = useT();

  if (items.length === 0) {
    return null;
  }

  return (
    <aside
      aria-label={tOr('studio.uploadDockTitle', {}, '')}
      className="tw:fixed tw:start-0 tw:bottom-0 tw:z-toast tw:w-full tw:p-gutter-compact tw:medium:max-w-[24rem]"
    >
      <Card.Root elevation={3}>
        <Card.Header>
          <Card.Title>{tOr('studio.uploadDockTitle', {}, '')}</Card.Title>
        </Card.Header>
        <Card.Body>
          <ul className="tw:flex tw:flex-col tw:gap-stack">
            {items.map((item) => (
              <li key={item.id}>
                <UploadRow item={item} />
              </li>
            ))}
          </ul>
        </Card.Body>
      </Card.Root>
    </aside>
  );
}
