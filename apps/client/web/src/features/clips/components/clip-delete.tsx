import { useNavigate } from '@tanstack/react-router';
import type { ClipView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { AlertDialog, Button, useToast, useUiCopy } from '@vp/ui';

import { useDeleteClip } from '../hooks/use-delete-clip';

/** Deletes a clip after the creator confirms; its video is untouched. */
export function ClipDelete({ clip }: { clip: Pick<ClipView, 'id' | 'videoId'> }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const { tOr } = useT();
  const { cancel } = useUiCopy();
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
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button tone="danger" variant="soft">
          {tOr('clips.delete', {}, '')}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Title>{tOr('clips.deleteTitle', {}, '')}</AlertDialog.Title>
        <AlertDialog.Description>{tOr('clips.deleteDescription', {}, '')}</AlertDialog.Description>
        <AlertDialog.Footer>
          <AlertDialog.Cancel asChild>
            <Button variant="ghost">{cancel}</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action asChild>
            <Button tone="danger" variant="solid" loading={deleteClip.isPending} onClick={confirm}>
              {tOr('clips.deleteConfirm', {}, '')}
            </Button>
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
