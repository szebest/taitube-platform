import { render } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { type ReactNode, useState } from 'react';
import { AppProviders } from '#app/__tests__/providers';
import { PostComposer, type PostComposerRootProps } from '../index';
import type { PostDraft } from '../types';
import { EMPTY_DRAFT } from '../utils/draft';

type RootOptions = Partial<Pick<PostComposerRootProps, 'mode' | 'pollLocked' | 'problem'>>;

/** `parts` inside a root holding a draft of `initial` over a new post; `draft()` is what it holds now. */
export function renderComposer(
  parts: ReactNode,
  { initial = {}, ...root }: RootOptions & { initial?: Partial<PostDraft> } = {}
) {
  let held: PostDraft = { ...EMPTY_DRAFT, ...initial };

  function Harness() {
    const [draft, setDraft] = useState(held);
    held = draft;

    return (
      <PostComposer.Root draft={draft} onDraftChange={setDraft} {...root}>
        {parts}
      </PostComposer.Root>
    );
  }

  return {
    user: userEvent.setup(),
    draft: () => held,
    ...render(<Harness />, { wrapper: AppProviders }),
  };
}
