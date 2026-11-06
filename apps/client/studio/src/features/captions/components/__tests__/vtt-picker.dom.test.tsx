import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { VttPicker } from '../vtt-picker';

function renderPicker() {
  const onFile = vi.fn();
  const onTooLarge = vi.fn();
  const user = userEvent.setup();
  render(<VttPicker label="Replace" onFile={onFile} onTooLarge={onTooLarge} />, {
    wrapper: AppProviders,
  });
  return { user, onFile, onTooLarge };
}

const file = (bytes: number) => new File(['x'.repeat(bytes)], 'en.vtt', { type: 'text/vtt' });

describe('apps/client/studio: VttPicker', () => {
  it('hands over a file within the limit', async () => {
    const { user, onFile, onTooLarge } = renderPicker();
    const chosen = file(10);

    await user.upload(screen.getByLabelText('Choose a .vtt file'), chosen);

    expect(onFile).toHaveBeenCalledWith(chosen);
    expect(onTooLarge).not.toHaveBeenCalled();
  });

  it('refuses a file over 1 MiB without handing it over', async () => {
    const { user, onFile, onTooLarge } = renderPicker();

    await user.upload(screen.getByLabelText('Choose a .vtt file'), file(1_048_577));

    expect(onTooLarge).toHaveBeenCalledOnce();
    expect(onFile).not.toHaveBeenCalled();
  });
});
