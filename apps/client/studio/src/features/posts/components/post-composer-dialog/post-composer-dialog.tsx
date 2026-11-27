import { Button, ResponsiveModal, useToast } from '@kit/ui';
import type { ManagedPostView } from '@vp/api-contracts';
import { isPostPublished } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { failureCode, useFailureToast } from '@vp/queries';
import { useState } from 'react';
import { VersionConflictDialog } from '#app/components/dialogs/version-conflict-dialog';
import {
  decideDraft,
  type DraftUpdate,
  draftOfPost,
  EMPTY_DRAFT,
  PostComposer,
  type PostDraft,
} from '#app/components/posts/post-composer';
import { usePostImageUpload } from '#app/features/posts/hooks/use-post-image-upload';
import { useCreatePost, useUpdatePost } from '#app/features/posts/hooks/use-post-mutations';
import { useT } from '#app/lib/messages';
import { PlaylistPicker } from '../playlist-picker/playlist-picker';
import { VideoPicker } from '../video-picker/video-picker';

export interface PostComposerDialogProps {
  /** The post being edited, as the list holds it now; absent for a new post. */
  post?: ManagedPostView;
  onClose: () => void;
}

const hasVotes = ({ body }: ManagedPostView) =>
  (body.kind === 'poll' || body.kind === 'quiz') && (body.totalVotes ?? 0) > 0;

/** A new post, or an edit of one: the composer in a dialog, a drawer on a phone, saved against the post's version. */
export function PostComposerDialog({ post, onClose }: PostComposerDialogProps) {
  const { tOr } = useT();
  const toast = useToast();
  const showFailure = useFailureToast();
  const create = useCreatePost();
  const edit = useUpdatePost();
  const [draft, setDraft] = useState<PostDraft>(() => (post ? draftOfPost(post) : EMPTY_DRAFT));
  const [problem, setProblem] = useState<string>();
  const [conflict, setConflict] = useState(false);

  const change = (update: DraftUpdate) => {
    setProblem(undefined);
    setDraft(update);
  };
  const images = usePostImageUpload(change);
  const pending = create.isPending || edit.isPending;

  const saved = () => {
    toast({
      tone: 'success',
      title: tOr('studio.postsSaved', { mode: post ? 'edit' : draft.timing }, ''),
    });
    onClose();
  };

  const save = () => {
    const decided = decideDraft(draft, { now: new Date(), current: post?.status ?? null });
    if (!decided.ok) {
      const { error } = decided;
      return setProblem(
        error.kind === 'rule'
          ? error.message
          : tOr('studio.composerProblem', { reason: error.reason }, '')
      );
    }

    const failed = (error: unknown) =>
      failureCode(error) === ErrorCodes.VERSION_CONFLICT
        ? setConflict(true)
        : showFailure(tOr('studio.postsSaveFailed', {}, ''), error);
    if (post) {
      edit.mutate(
        { id: post.id, version: post.version, body: decided.value },
        { onSuccess: saved, onError: failed }
      );
    } else {
      create.mutate(decided.value, { onSuccess: saved, onError: failed });
    }
  };

  return (
    <>
      <ResponsiveModal.Root open onOpenChange={(open) => !open && onClose()}>
        <ResponsiveModal.Content size="lg">
          <ResponsiveModal.Header>
            <ResponsiveModal.Title>
              {tOr(post ? 'studio.composerTitleEdit' : 'studio.composerTitleNew', {}, '')}
            </ResponsiveModal.Title>
            <ResponsiveModal.Description>
              {tOr('studio.composerDescription', {}, '')}
            </ResponsiveModal.Description>
          </ResponsiveModal.Header>
          <ResponsiveModal.Body>
            <PostComposer.Root
              draft={draft}
              onDraftChange={change}
              mode={post ? 'edit' : 'create'}
              pollLocked={post !== undefined && hasVotes(post)}
              problem={problem}
            >
              <PostComposer.Kinds />
              <PostComposer.Text />
              <PostComposer.Images onFiles={images.add} refusal={images.refusal} />
              <PostComposer.Poll />
              <PostComposer.Quiz />
              <PostComposer.Video>
                <VideoPicker />
              </PostComposer.Video>
              <PostComposer.Playlist>
                <PlaylistPicker />
              </PostComposer.Playlist>
              <PostComposer.Comments />
              <PostComposer.Schedule
                published={post !== undefined && isPostPublished(post.status)}
              />
              <PostComposer.Problem />
            </PostComposer.Root>
          </ResponsiveModal.Body>
          <ResponsiveModal.Footer>
            <Button variant="outline" onClick={onClose}>
              {tOr('ui.cancel', {}, '')}
            </Button>
            <Button variant="solid" tone="accent" loading={pending} onClick={save}>
              {post
                ? tOr('studio.composerSave', {}, '')
                : tOr('studio.composerSubmit', { mode: draft.timing }, '')}
            </Button>
          </ResponsiveModal.Footer>
        </ResponsiveModal.Content>
      </ResponsiveModal.Root>
      <VersionConflictDialog
        open={conflict}
        onOpenChange={setConflict}
        onReload={() => {
          setConflict(false);
          if (post) setDraft(draftOfPost(post));
        }}
        onOverwrite={() => {
          setConflict(false);
          save();
        }}
      />
    </>
  );
}
