import { DropdownMenu, Icon, IconButton, useToast } from '@kit/ui';
import type { ManagedPostView } from '@vp/api-contracts';
import { isPostPublished } from '@vp/domain';
import { canManagePost } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { useFailureToast } from '@vp/queries';
import { usePinPost } from '#app/features/posts/hooks/use-post-mutations';
import { postExcerpt } from '#app/features/posts/utils/post-excerpt';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { useT } from '#app/lib/messages';

export interface PostRowMenuProps {
  post: ManagedPostView;
  onEdit: () => void;
  onStats: () => void;
  onDelete: () => void;
}

/** What a creator does to one post: edit it, pin it once published, read its stats, delete it. */
export function PostRowMenu({ post, onEdit, onStats, onDelete }: PostRowMenuProps) {
  const { tOr } = useT();
  const toast = useToast();
  const showFailure = useFailureToast();
  const { channelId, ownerId } = useActiveChannel();
  const pin = usePinPost();
  const resource = { ownerId, channelId };
  const canEdit = useCan(canManagePost, { action: 'update', post: resource });
  const canPin = useCan(canManagePost, { action: 'pin', post: resource });
  const canDelete = useCan(canManagePost, { action: 'delete', post: resource });
  const published = isPostPublished(post.status);

  const togglePin = () =>
    pin.mutate(
      { id: post.id, pin: !post.pinned },
      {
        onSuccess: () =>
          toast({
            tone: 'success',
            title: tOr(
              post.pinned ? 'studio.postsUnpinnedToast' : 'studio.postsPinnedToast',
              {},
              ''
            ),
          }),
        onError: (error) => showFailure(tOr('studio.postsPinFailed', {}, ''), error),
      }
    );

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton
          size="sm"
          aria-label={tOr('studio.postsActions', { title: postExcerpt(post.body) }, '')}
        >
          <Icon name="more" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {canEdit && (
          <DropdownMenu.Item onSelect={onEdit}>{tOr('studio.postsEdit', {}, '')}</DropdownMenu.Item>
        )}
        {canPin && published && (
          <DropdownMenu.Item onSelect={togglePin}>
            {tOr(post.pinned ? 'studio.postsUnpin' : 'studio.postsPin', {}, '')}
          </DropdownMenu.Item>
        )}
        {published && (
          <DropdownMenu.Item onSelect={onStats}>
            {tOr('studio.postsStats', {}, '')}
          </DropdownMenu.Item>
        )}
        {canDelete && (
          <DropdownMenu.Item tone="danger" onSelect={onDelete}>
            {tOr('studio.postsDelete', {}, '')}
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
