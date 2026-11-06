import { useMutation } from '@tanstack/react-query';
import type { CaptionTrackView } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Badge, Button, useToast } from '@vp/ui';
import { useState } from 'react';
import {
  deleteTrackMutationOptions,
  generateMutationOptions,
  uploadTrackMutationOptions,
} from '../api/caption-mutations';
import { useLanguageLabel } from '../hooks/use-language-label';
import { fileIssueOf, hasCode, reasonCopy } from '../lib/caption-failures';
import { ConfirmDialog } from './confirm-dialog';
import { CueEditorDialog } from './cue-editor-dialog';
import { VttPicker } from './vtt-picker';

const STATUS_TONE = {
  pending: 'info',
  ready: 'success',
  failed: 'danger',
  disabled: 'neutral',
} as const satisfies Record<CaptionTrackView['status'], string>;

export interface CaptionTrackRowProps {
  videoId: string;
  track: CaptionTrackView;
}

/** One track: what it is, why it is not ready when it is not, and what the creator can do with it. */
export function CaptionTrackRow({ videoId, track }: CaptionTrackRowProps) {
  const api = useApi();
  const toast = useToast();
  const { tOr } = useT();
  const languageLabel = useLanguageLabel();
  const [editedVersion, setEditedVersion] = useState<number>();
  const [deleting, setDeleting] = useState(false);
  const [overwriting, setOverwriting] = useState(false);
  const [fileIssue, setFileIssue] = useState<string>();
  const upload = useMutation(uploadTrackMutationOptions(api, videoId));
  const remove = useMutation(deleteTrackMutationOptions(api, videoId));
  const generate = useMutation(generateMutationOptions(api, videoId));

  const failed = (key: 'studio.captionsActionFailed') => () =>
    toast({ tone: 'danger', title: tOr(key, {}, '') });
  const generated = track.kind !== 'uploaded';
  const explained = track.status === 'failed' || track.status === 'disabled';

  const regenerate = (overwrite: boolean) =>
    generate.mutate(
      { language: track.language, overwrite },
      {
        onSuccess: () =>
          toast({ tone: 'success', title: tOr('studio.captionsGenerationStarted', {}, '') }),
        onError: (error) =>
          hasCode(error, ErrorCodes.CAPTION_OVERWRITE_UNCONFIRMED)
            ? setOverwriting(true)
            : failed('studio.captionsActionFailed')(),
      }
    );

  const replace = (vtt: string) => {
    if (track.language === null) return;
    setFileIssue(undefined);
    upload.mutate(
      { language: track.language, vtt },
      {
        onSuccess: () => toast({ tone: 'success', title: tOr('studio.captionsUploaded', {}, '') }),
        onError: (error) =>
          setFileIssue(fileIssueOf(error) ?? tOr('studio.captionsUploadFailed', {}, '')),
      }
    );
  };

  return (
    <li
      aria-label={languageLabel(track.language)}
      className="flex flex-col gap-inline rounded-sm border border-border p-inset-control"
    >
      <div className="flex flex-wrap items-center gap-inline">
        <span className="me-auto text-label">{languageLabel(track.language)}</span>
        <Badge>{tOr('studio.captionsKind', { kind: track.kind }, '')}</Badge>
        <Badge tone={STATUS_TONE[track.status]}>
          {tOr('studio.captionsStatus', { status: track.status }, '')}
        </Badge>
      </div>
      {explained && (
        <p className="m-0 text-body-sm text-fg-muted">{tOr(reasonCopy(track.reason), {}, '')}</p>
      )}
      {fileIssue !== undefined && (
        <p role="alert" className="m-0 text-body-sm text-danger">
          {fileIssue}
        </p>
      )}
      <div className="flex flex-wrap gap-inline">
        {track.status === 'ready' && track.language !== null && track.version !== undefined && (
          <Button variant="outline" size="sm" onClick={() => setEditedVersion(track.version)}>
            {tOr('studio.captionsEdit', {}, '')}
          </Button>
        )}
        {track.language !== null && (
          <VttPicker
            label={tOr('studio.captionsReplace', {}, '')}
            onText={replace}
            onTooLarge={() => setFileIssue(tOr('studio.captionsFileTooLarge', {}, ''))}
          />
        )}
        {generated && track.status !== 'pending' && (
          <Button
            variant="outline"
            size="sm"
            loading={generate.isPending}
            onClick={() => regenerate(false)}
          >
            {track.status === 'failed'
              ? tOr('studio.captionsRetry', {}, '')
              : tOr('studio.captionsRegenerate', {}, '')}
          </Button>
        )}
        {track.language !== null && (
          <Button variant="outline" tone="danger" size="sm" onClick={() => setDeleting(true)}>
            {tOr('studio.captionsDelete', {}, '')}
          </Button>
        )}
      </div>
      <CueEditorDialog
        videoId={videoId}
        track={track}
        baseVersion={editedVersion ?? 0}
        onRebase={setEditedVersion}
        open={editedVersion !== undefined}
        onOpenChange={(open) => !open && setEditedVersion(undefined)}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={tOr('studio.captionsDeleteTitle', {}, '')}
        body={tOr('studio.captionsDeleteBody', {}, '')}
        confirm={tOr('studio.captionsDelete', {}, '')}
        onConfirm={() =>
          track.language !== null &&
          remove.mutate(track.language, {
            onSuccess: () =>
              toast({ tone: 'success', title: tOr('studio.captionsDeleted', {}, '') }),
            onError: failed('studio.captionsActionFailed'),
          })
        }
      />
      <ConfirmDialog
        open={overwriting}
        onOpenChange={setOverwriting}
        title={tOr('studio.captionsOverwriteTitle', {}, '')}
        body={tOr('studio.captionsOverwriteBody', {}, '')}
        confirm={tOr('studio.captionsOverwriteConfirm', {}, '')}
        onConfirm={() => regenerate(true)}
      />
    </li>
  );
}
