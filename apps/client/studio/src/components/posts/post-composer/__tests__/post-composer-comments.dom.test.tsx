import { axeViolations } from '@kit/web-testing/dom';
import { screen } from '@testing-library/react';
import { PostComposer } from '../index';
import { renderComposer } from './render-composer';

const renderComments = (commentsEnabled: boolean) =>
  renderComposer(<PostComposer.Comments />, { initial: { commentsEnabled } });

describe('apps/client/studio: PostComposerComments', () => {
  it.each([true, false])('flips replies from %s', async (before) => {
    const { user, draft } = renderComments(before);

    await user.click(screen.getByRole('switch', { name: 'Let viewers reply' }));

    expect(draft().commentsEnabled).toBe(!before);
  });

  it('passes axe', async () => {
    renderComments(true);

    expect(await axeViolations()).toEqual([]);
  });
});
