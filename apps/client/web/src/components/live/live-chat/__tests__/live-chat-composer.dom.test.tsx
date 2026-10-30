import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { AppProviders } from '#app/__tests__/providers';
import { LiveChatRoot } from '../live-chat';
import { LiveChatComposer, type LiveChatComposerProps } from '../live-chat-composer';

const renderComposer = (props: LiveChatComposerProps = {}) => {
  const onSend = vi.fn();
  render(
    <AppProviders>
      <LiveChatRoot onSend={onSend}>
        <LiveChatComposer {...props} />
      </LiveChatRoot>
    </AppProviders>
  );
  return { onSend, field: screen.getByRole('textbox', { name: 'Say something' }) };
};

describe('apps/client/web: LiveChatComposer', () => {
  it('sends trimmed words and clears the field', async () => {
    const { onSend, field } = renderComposer();

    await userEvent.type(field, ' hi {Enter}');

    expect(onSend).toHaveBeenCalledWith('hi');
    expect(field).toHaveValue('');
  });

  it.each([{ props: { disabled: true } }, { props: { wait: 'Wait 5 s' } }])(
    'blocks the field with $props',
    ({ props }) => {
      const { field } = renderComposer(props);

      expect(field).toBeDisabled();
    }
  );

  it('counts from 80 % of the limit', async () => {
    const { field } = renderComposer({ maxLength: 10 });

    await userEvent.type(field, '1234567');
    expect(screen.queryByText('7 / 10')).not.toBeInTheDocument();
    await userEvent.type(field, '8');

    expect(screen.getByText('8 / 10')).toBeInTheDocument();
  });
});
