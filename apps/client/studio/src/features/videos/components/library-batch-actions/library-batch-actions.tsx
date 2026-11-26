import { useCan } from '@vp/permissions-react';
import { useState } from 'react';
import { BulkActionBar } from '#app/components/table/bulk-action-bar';
import type { BatchOutcome } from '#app/features/videos/api/batch-actions';
import { useBatchActions } from '#app/features/videos/hooks/use-batch-actions';
import { BULK_FIELDS, type BulkField } from '#app/features/videos/utils/bulk-fields';
import { useT } from '#app/lib/messages';
import { DeleteVideosDialog } from '../delete-videos-dialog/delete-videos-dialog';
import { LibraryFieldDialog } from '../library-field-dialog/library-field-dialog';
import type { CreatorVideo } from '../library-video-row/library-video-row';

interface LibraryBatchActionsProps {
  videos: readonly CreatorVideo[];
  onSettled: (outcome: BatchOutcome) => void;
}

/** The actions on the selected videos: one bulk edit for any field, and a delete per video. */
export function LibraryBatchActions({ videos, onSettled }: LibraryBatchActionsProps) {
  const { tOr } = useT();
  const canUpdate = useCan('update', 'Video');
  const canDelete = useCan('delete', 'Video');
  const { deleteVideos, editVideos, pending } = useBatchActions();
  const [field, setField] = useState<BulkField>('visibility');
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <BulkActionBar.Root aria-label={tOr('studio.batchBarLabel', {}, '')} pending={pending}>
        {canUpdate &&
          BULK_FIELDS.map((name) => (
            <BulkActionBar.Action
              key={name}
              onClick={() => {
                setField(name);
                setEditing(true);
              }}
            >
              {tOr('studio.batchAction', { field: name }, '')}
            </BulkActionBar.Action>
          ))}
        {canDelete && (
          <BulkActionBar.Action tone="danger" onClick={() => setConfirming(true)}>
            {tOr('studio.deleteVideo', {}, '')}
          </BulkActionBar.Action>
        )}
      </BulkActionBar.Root>
      <LibraryFieldDialog
        open={editing}
        onOpenChange={setEditing}
        field={field}
        count={videos.length}
        onApply={(patch) => void editVideos(videos, patch).then(onSettled)}
      />
      <DeleteVideosDialog
        open={confirming}
        onOpenChange={setConfirming}
        count={videos.length}
        onConfirm={() => void deleteVideos(videos).then(onSettled)}
      />
    </>
  );
}
