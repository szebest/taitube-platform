import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { AppProviders } from '#app/__tests__/providers';
import { CommentItemRoot } from '../comment-item';
import { CommentItemBody } from '../comment-item-body';
import type { CommentState } from '../types';

class FakeResizeObserver {
  constructor(readonly callback: () => void) {
    callback();
  }
  observe() {}
  disconnect() {}
}

const renderBody = (state: CommentState = 'view') =>
  render(
    <AppProviders>
      <CommentItemRoot state={state}>
        <CommentItemBody>The tram is great.</CommentItemBody>
      </CommentItemRoot>
    </AppProviders>
  );

describe('apps/client/web: CommentItemBody', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    { state: 'view' as const, text: 'The tram is great.' },
    { state: 'editing' as const, text: 'The tram is great.' },
    { state: 'deleted' as const, text: 'This comment was deleted' },
    { state: 'removed' as const, text: 'This comment was removed' },
  ])('shows "$text" in the $state state', ({ state, text }) => {
    renderBody(state);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('offers Read more only when the text is clamped, and toggles it', async () => {
    renderBody();
    expect(screen.queryByRole('button', { name: 'Read more' })).not.toBeInTheDocument();

    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    try {
      renderBody();
      const more = await screen.findByRole('button', { name: 'Read more' });
      await userEvent.click(more);

      expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
    }
  });
});
