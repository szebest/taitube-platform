import { act, screen } from '@testing-library/react';
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

const renderWithExtras = () =>
  renderWithCopy(
    <ErrorState.Root kind="server" onRetry={vi.fn()}>
      <ErrorState.Title asChild>
        <h1>We could not load this video</h1>
      </ErrorState.Title>
      <ErrorState.Retry />
      <ErrorState.Reference value="7f3a-91c2" />
      <ErrorState.Details>{'GET /api/v1/videos/42 -> 504'}</ErrorState.Details>
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

  it('shows a busy retry button that ignores clicks while retrying', async () => {
    const onRetry = vi.fn();
    renderErrorState({ kind: 'server', onRetry, retrying: true });

    await userEvent.click(screen.getByRole('button', { name: 'retry' }));

    expect(screen.getByRole('button', { name: 'retry' })).toHaveAttribute('aria-busy', 'true');
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('copies the reference, says so for two seconds, then goes back to the copy word', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithExtras();

    await user.click(screen.getByRole('button', { name: 'copy' }));

    expect(await navigator.clipboard.readText()).toBe('7f3a-91c2');
    expect(screen.getByRole('status')).toHaveTextContent('copied');
    expect(screen.getByRole('button', { name: 'copied' })).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(2000));

    expect(screen.getByRole('button', { name: 'copy' })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('keeps the technical text behind a disclosure', async () => {
    renderWithExtras();
    const summary = screen.getByText('technicalDetails');

    expect(screen.getByText('GET /api/v1/videos/42 -> 504')).not.toBeVisible();

    await userEvent.click(summary);

    expect(screen.getByText('GET /api/v1/videos/42 -> 504')).toBeVisible();
  });

  it('passes axe with the reference and the details', async () => {
    renderWithExtras();

    expect(await axeViolations()).toEqual([]);
  });

  it('passes axe in every kind', async () => {
    for (const kind of KINDS) {
      renderErrorState({ kind, onRetry: vi.fn() });
    }

    expect(await axeViolations()).toEqual([]);
  });
});
