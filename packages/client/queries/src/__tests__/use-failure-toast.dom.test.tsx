import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';
import { ToastProvider, createToaster } from '@vp/ui';

import { AppWords } from '../app-words';
import { useFailureToast } from '../use-failure-toast';

function Failing({ error, retry }: { error: unknown; retry?: () => void }) {
  const showFailure = useFailureToast();
  return (
    <button type="button" onClick={() => showFailure('The reaction was not saved', error, retry)}>
      Save
    </button>
  );
}

async function renderFailing(props: { error: unknown; retry?: () => void }) {
  render(
    <AppWords>
      <ToastProvider toaster={createToaster()}>
        <Failing {...props} />
      </ToastProvider>
    </AppWords>
  );
  await userEvent.setup().click(screen.getByRole('button', { name: 'Save' }));
}

describe('@vp/queries: useFailureToast', () => {
  it('names what failed with the presented copy and a retry that runs the action again', async () => {
    const retry = vi.fn();
    await renderFailing({ error: new ApiError(503, ErrorCodes.DATABASE_UNAVAILABLE, ''), retry });

    expect(await screen.findByText('The reaction was not saved')).toBeInTheDocument();
    expect(
      screen.getByText('The service is temporarily unavailable. Try again shortly.')
    ).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('offers no retry when the caller has none', async () => {
    await renderFailing({ error: new Error('offline') });

    await screen.findByText('The reaction was not saved');

    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});
