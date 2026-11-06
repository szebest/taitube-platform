import { useNavigate } from '@tanstack/react-router';
import type { ClipView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useToast } from '@vp/ui';
import { ClipDeleteDialog } from '#app/components/watch/clip-delete-dialog';
import { useDeleteClip } from '../hooks/use-delete-clip';

/** Deletes a clip after the creator confirms; its video is untouched. */
export function ClipDelete({ clip }: { clip: Pick<ClipView, 'id' | 'videoId'> }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const { tOr } = useT();
  const deleteClip = useDeleteClip(clip.id);

  const confirm = () =>
    deleteClip.mutate(undefined, {
      onSuccess: () => {
        showToast({ tone: 'success', title: tOr('clips.deleted', {}, '') });
        void navigate({ to: '/watch/$videoId', params: { videoId: clip.videoId } });
      },
      onError: () => showToast({ tone: 'danger', title: tOr('clips.deleteFailed', {}, '') }),
    });

  return (
    <ClipDeleteDialog
      triggerLabel={tOr('clips.delete', {}, '')}
      title={tOr('clips.deleteTitle', {}, '')}
      description={tOr('clips.deleteDescription', {}, '')}
      confirmLabel={tOr('clips.deleteConfirm', {}, '')}
      pending={deleteClip.isPending}
      onConfirm={confirm}
    />
  );
}
