import { axeViolations } from '@kit/web-testing/dom';
import { screen } from '@testing-library/react';
import { PostComposer } from '../index';
import { renderComposer } from './render-composer';

const renderKinds = (options: Parameters<typeof renderComposer>[1] = {}) =>
  renderComposer(
    <>
      <PostComposer.Kinds />
      <PostComposer.Text />
      <PostComposer.Poll />
      <PostComposer.Problem />
    </>,
    options
  );

describe('apps/client/studio: PostComposer', () => {
  it.each([
    { tab: 'Poll', kind: 'poll' },
    { tab: 'Text', kind: 'text' },
  ])('switches the draft to the $kind kind from its tab', async ({ tab, kind }) => {
    const { user, draft } = renderKinds({ initial: { kind: kind === 'poll' ? 'text' : 'poll' } });

    await user.click(screen.getByRole('tab', { name: tab }));

    expect(draft().kind).toBe(kind);
  });

  it('lists the six kinds', () => {
    renderKinds();

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Text',
      'Images',
      'Poll',
      'Quiz',
      'Video',
      'Playlist',
    ]);
  });

  it('leaves the kind of a post being edited as it is', () => {
    renderKinds({ mode: 'edit', initial: { kind: 'poll' } });

    expect(screen.getByRole('tab', { name: 'Poll' })).toBeEnabled();
    expect(screen.getByRole('tab', { name: 'Text' })).toBeDisabled();
  });

  it.each([
    {
      scenario: 'shows a problem as an alert',
      problem: 'text is too long',
      alerts: ['text is too long'],
    },
    { scenario: 'shows nothing without one', problem: undefined, alerts: [] },
  ])('$scenario', ({ problem, alerts }) => {
    renderKinds({ problem });

    expect(screen.queryAllByRole('alert').map((alert) => alert.textContent)).toEqual(alerts);
  });

  it('passes axe', async () => {
    renderKinds({ problem: 'text is too long' });

    expect(await axeViolations()).toEqual([]);
  });
});
