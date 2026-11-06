import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { VttPicker } from '../vtt-picker';

function renderPicker() {
  const onText = vi.fn();
  const onTooLarge = vi.fn();
  const user = userEvent.setup();
  render(<VttPicker label="Replace" onText={onText} onTooLarge={onTooLarge} />, {
    wrapper: AppProviders,
  });
  return { user, onText, onTooLarge };
}

const file = (text: string) => new File([text], 'en.vtt', { type: 'text/vtt' });

describe('apps/client/studio: VttPicker', () => {
  it('hands over the text of a file within the limit', async () => {
    const { user, onText, onTooLarge } = renderPicker();

    await user.upload(screen.getByLabelText('Choose a .vtt file'), file('WEBVTT\n'));

    expect(onText).toHaveBeenCalledWith('WEBVTT\n');
    expect(onTooLarge).not.toHaveBeenCalled();
  });

  it.each([
    { scenario: 'is over 1 MiB as text', text: 'x'.repeat(1_048_577), refused: true },
    {
      scenario: 'fits as text but not once JSON-escaped',
      text: '\n'.repeat(600_000),
      refused: true,
    },
    { scenario: 'fits once JSON-escaped', text: 'x'.repeat(1_048_000), refused: false },
  ])('judges a file that $scenario by the body the API receives', async ({ text, refused }) => {
    const { user, onText, onTooLarge } = renderPicker();

    await user.upload(screen.getByLabelText('Choose a .vtt file'), file(text));

    expect(onTooLarge).toHaveBeenCalledTimes(refused ? 1 : 0);
    expect(onText).toHaveBeenCalledTimes(refused ? 0 : 1);
  });
});
