import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { renderWithCopy } from '../../../__tests__/render-with-copy';
import { ErrorState, type ErrorStateKind } from '..';
import type { ErrorStateRootProps } from '../error-state';

const KINDS: ErrorStateKind[] = [
  'generic',
  'not-found',
  'forbidden',
  'unauthorised',
  'rate-limited',
  'server',
];

const renderErrorState = (props: ErrorStateRootProps) =>
  renderWithCopy(
    <ErrorState.Root {...props}>
      <ErrorState.Illustration />
      <ErrorState.Title asChild>
        <h1>We could not load this video</h1>
      </ErrorState.Title>
      <ErrorState.Description>The server took too long to answer.</ErrorState.Description>
      <ErrorState.Retry />
      <ErrorState.Action asChild>
        <a href="/">Go to Home</a>
      </ErrorState.Action>
    </ErrorState.Root>
  );

describe('@vp/components: ErrorState', () => {
  it('retries through the root, and shows the button only when there is a retry', async () => {
    const onRetry = vi.fn();
    const { unmount } = renderErrorState({ kind: 'server', onRetry });

    await userEvent.click(screen.getByRole('button', { name: 'retry' }));
    unmount();
    renderErrorState({ kind: 'not-found' });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'retry' })).not.toBeInTheDocument();
  });

  it('passes axe in every kind', async () => {
    for (const kind of KINDS) {
      renderErrorState({ kind, onRetry: vi.fn() });
    }

    expect(await axeViolations()).toEqual([]);
  });
});
