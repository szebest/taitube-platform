import { ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';
import { useT } from '@vp/intl-react';
import { fromPromise, isOk } from '@vp/result';
import { AlertDialog, Button, Field, Textarea, useToast, useUiCopy } from '@vp/ui';
import { useState } from 'react';

import type { AdminVideo } from '#app/features/admin/api/admin-videos';
import {
  useDeleteVideo,
  useForcePrivate,
  useRejectVideo,
} from '#app/features/admin/hooks/use-video-overrides';

export type VideoOverride = 'force-private' | 'reject' | 'delete';

const REASON_MAX_LENGTH = 500;

const COPY = {
  'force-private': {
    title: 'studio.adminForcePrivateTitle',
    description: 'studio.adminForcePrivateDescription',
    confirm: 'studio.adminVideoForcePrivate',
  },
  reject: {
    title: 'studio.adminRejectTitle',
    description: 'studio.adminRejectDescription',
    confirm: 'studio.adminVideoReject',
  },
  delete: {
    title: 'studio.adminDeleteVideoTitle',
    description: 'studio.adminDeleteVideoDescription',
    confirm: 'studio.adminVideoDelete',
  },
} as const satisfies Record<VideoOverride, Record<string, string>>;

export interface VideoOverrideDialogProps {
  action: VideoOverride;
  video: AdminVideo;
  onClose: () => void;
}

/**
 * Asks before an admin overrides a video, naming it and what happens to it. Only a rejection takes a
 * reason, because the takedown is the one endpoint that stores one; it is required and focus starts on Cancel.
 */
export function VideoOverrideDialog({ action, video, onClose }: VideoOverrideDialogProps) {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const toast = useToast();
  const forcePrivate = useForcePrivate();
  const reject = useRejectVideo();
  const remove = useDeleteVideo();
  const [reason, setReason] = useState('');

  const title = video.title ?? tOr('browse.untitled', {}, '');
  const copy = COPY[action];
  const needsReason = action === 'reject';
  const missingReason = needsReason && reason.trim() === '';

  const overrides: Record<VideoOverride, () => Promise<unknown>> = {
    'force-private': () => forcePrivate.mutateAsync(video),
    reject: () => reject.mutateAsync({ video, reason: reason.trim() }),
    delete: () => remove.mutateAsync(video),
  };

  const confirm = async () => {
    const done = await fromPromise(overrides[action], (cause) => cause);
    if (isOk(done)) {
      return;
    }

    const conflict =
      done.error instanceof ApiError && done.error.code === ErrorCodes.VERSION_CONFLICT;
    toast({
      tone: 'danger',
      title: tOr(conflict ? 'studio.adminVideoConflict' : 'studio.adminVideoActionFailed', {}, ''),
    });
  };

  return (
    <AlertDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Content size="sm">
        <AlertDialog.Title>{tOr(copy.title, { title }, '')}</AlertDialog.Title>
        <AlertDialog.Description>{tOr(copy.description, { title }, '')}</AlertDialog.Description>
        {needsReason && (
          <Field.Root>
            <Field.Label>{tOr('studio.adminRejectReason', {}, '')}</Field.Label>
            <Textarea
              value={reason}
              maxLength={REASON_MAX_LENGTH}
              onChange={(event) => setReason(event.target.value)}
            />
            <Field.Hint>{tOr('studio.adminRejectReasonHint', {}, '')}</Field.Hint>
          </Field.Root>
        )}
        <AlertDialog.Footer>
          <AlertDialog.Cancel asChild>
            <Button variant="outline">{cancel}</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action asChild>
            <Button variant="solid" tone="danger" disabled={missingReason} onClick={confirm}>
              {tOr(copy.confirm, {}, '')}
            </Button>
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
