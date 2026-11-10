import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { IntlProvider } from '@vp/intl-react';
import { PictureInPictureButton } from '../picture-in-picture-button';

function renderButton(props: { available: boolean; active?: boolean }) {
  const onRequest = vi.fn();
  const onExit = vi.fn();
  render(
    <IntlProvider locale="en" timeZone="UTC">
      <PictureInPictureButton active={false} {...props} onRequest={onRequest} onExit={onExit} />
    </IntlProvider>
  );
  return { onRequest, onExit };
}

describe('apps/client/web: PictureInPictureButton', () => {
  it('draws nothing where the browser has no picture in picture', () => {
    renderButton({ available: false });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([
    { active: false, name: 'Picture in picture', call: 'onRequest' },
    { active: true, name: 'Exit picture in picture', call: 'onExit' },
  ] as const)('offers $name and asks for it', async ({ active, name, call }) => {
    const calls = renderButton({ available: true, active });

    await userEvent.click(screen.getByRole('button', { name }));

    expect(calls[call]).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', String(active));
  });
});
