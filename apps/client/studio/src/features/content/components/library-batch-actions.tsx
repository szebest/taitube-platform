import { VIDEO_VISIBILITIES } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { useCan } from '@vp/permissions-react';
import { Button, DropdownMenu } from '@vp/ui';
import { useState } from 'react';

import type { BatchOutcome } from '../api/batch-actions';
import { useBatchActions } from '../hooks/use-batch-actions';
import { DeleteVideosDialog } from './delete-videos-dialog';
import type { CreatorVideo } from './library-video-row';

const VISIBILITY_ORDER = [...VIDEO_VISIBILITIES].reverse();

interface LibraryBatchActionsProps {
  videos: readonly CreatorVideo[];
  onSettled: (outcome: BatchOutcome) => void;
}

export function LibraryBatchActions({ videos, onSettled }: LibraryBatchActionsProps) {
  const { tOr } = useT();
  const canUpdate = useCan('update', 'Video');
  const canDelete = useCan('delete', 'Video');
  const { deleteVideos, setVisibility, pending } = useBatchActions();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      {canUpdate && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="outline" size="sm" disabled={pending}>
              {tOr('studio.setVisibility', {}, '')}
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            {VISIBILITY_ORDER.map((visibility) => (
              <DropdownMenu.Item
                key={visibility}
                onSelect={() => setVisibility(videos, visibility).then(onSettled)}
              >
                {tOr('videos.visibility', { visibility }, '')}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      )}
      {canDelete && (
        <>
          <Button
            variant="outline"
            size="sm"
            tone="danger"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            {tOr('studio.deleteVideo', {}, '')}
          </Button>
          <DeleteVideosDialog
            open={confirming}
            onOpenChange={setConfirming}
            count={videos.length}
            onConfirm={() => deleteVideos(videos).then(onSettled)}
          />
        </>
      )}
    </>
  );
}
