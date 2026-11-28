import { Callout, Tabs } from '@kit/ui';
import { POST_KINDS, type PostKind } from '@vp/domain';
import type { ReactNode } from 'react';
import { useT } from '#app/lib/messages';
import { PostComposerContext, usePostComposer } from './post-composer.context';
import type { DraftUpdate, PostComposerMode, PostDraft } from './types';

export interface PostComposerRootProps {
  draft: PostDraft;
  onDraftChange: (update: DraftUpdate) => void;
  mode?: PostComposerMode;
  /** The poll has votes: its question and options are read-only. */
  pollLocked?: boolean;
  /** What stops the draft being saved, once the creator tried. */
  problem?: string;
  children: ReactNode;
}

const isKind = (value: string): value is PostKind => POST_KINDS.some((kind) => kind === value);

/** The draft of one post, edited kind by kind; the parts read and change it through the root. */
export function PostComposerRoot({
  draft,
  onDraftChange,
  mode = 'create',
  pollLocked = false,
  problem,
  children,
}: PostComposerRootProps) {
  const change = (patch: Partial<PostDraft>) =>
    onDraftChange((current) => ({ ...current, ...patch }));
  const shared = { draft, mode, pollLocked, problem, update: onDraftChange, change };

  return (
    <PostComposerContext value={shared}>
      <Tabs.Root
        value={draft.kind}
        onValueChange={(kind) => isKind(kind) && change({ kind })}
        className="flex flex-col gap-stack"
      >
        {children}
      </Tabs.Root>
    </PostComposerContext>
  );
}

/** One tab per kind; while editing, the post keeps the kind it has. */
export function PostComposerKinds() {
  const { tOr } = useT();
  const { draft, mode } = usePostComposer('Kinds');

  return (
    <Tabs.List aria-label={tOr('studio.composerKinds', {}, '')}>
      {POST_KINDS.map((kind) => (
        <Tabs.Tab key={kind} value={kind} disabled={mode === 'edit' && kind !== draft.kind}>
          {tOr('studio.postsKind', { kind }, '')}
        </Tabs.Tab>
      ))}
    </Tabs.List>
  );
}

export function PostComposerProblem() {
  const { problem } = usePostComposer('Problem');

  if (problem === undefined) return null;
  return (
    <Callout.Root tone="danger" role="alert">
      <Callout.Icon />
      <Callout.Body>{problem}</Callout.Body>
    </Callout.Root>
  );
}
