import { axeViolations } from '@kit/web-testing/dom';
import { fireEvent, screen } from '@testing-library/react';
import { PostComposer } from '../index';
import type { PostDraft } from '../types';
import { renderComposer } from './render-composer';

const VIDEO: Partial<PostDraft> = {
  kind: 'video_share',
  video: { id: 'v', title: 'Tour', durationMs: 600_000 },
  startMs: 65_000,
};

function renderShare(initial: Partial<PostDraft>) {
  return renderComposer(
    <>
      <PostComposer.Video>
        <p>Video picker</p>
      </PostComposer.Video>
      <PostComposer.Playlist>
        <p>Playlist picker</p>
      </PostComposer.Playlist>
    </>,
    { initial }
  );
}

describe('apps/client/studio: PostComposerShare', () => {
  it.each([
    { kind: 'video_share', picker: 'Video picker' },
    { kind: 'playlist_share', picker: 'Playlist picker' },
  ] as const)('puts the picker of a $kind post in its panel', ({ kind, picker }) => {
    renderShare({ kind });

    expect(screen.getByText(picker)).toBeInTheDocument();
  });

  it('says where the card opens the video and moves it with the slider', () => {
    const { draft } = renderShare(VIDEO);

    expect(screen.getByText('The card opens the video at 1:05.')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Start time' }), { key: 'ArrowRight' });

    expect(draft().startMs).toBe(66_000);
  });

  it.each([
    { scenario: 'no video chosen', initial: { kind: 'video_share' } },
    {
      scenario: 'a video of unknown length',
      initial: { kind: 'video_share', video: { id: 'v', title: 'Tour', durationMs: null } },
    },
  ] as const)('offers no start time with $scenario', ({ initial }) => {
    renderShare(initial);

    expect(screen.queryByRole('slider')).toBeNull();
  });

  it.each([{ kind: 'video_share' }, { kind: 'playlist_share' }] as const)(
    'writes the comment of a $kind post into the draft, counted against 500',
    async ({ kind }) => {
      const { user, draft } = renderShare({ kind });

      await user.type(screen.getByRole('textbox', { name: /Your comment/ }), 'Watch this');

      expect(draft().comment).toBe('Watch this');
      expect(screen.getByText('10 of 500')).toBeInTheDocument();
    }
  );

  it('passes axe', async () => {
    renderShare(VIDEO);

    expect(await axeViolations()).toEqual([]);
  });
});
