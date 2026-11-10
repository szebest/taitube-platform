import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { PartyChat, type PartyChatComposerProps, type PartyChatLineProps } from '..';

interface Setup {
  line?: Partial<PartyChatLineProps>;
  composer?: PartyChatComposerProps;
  onSend?: (text: string) => void;
}

const renderChat = ({ line = {}, composer = { state: 'open' }, onSend = vi.fn() }: Setup = {}) =>
  render(
    <AppProviders>
      <PartyChat.Root onSend={onSend}>
        <PartyChat.List>
          <PartyChat.Line author="Ana" {...line}>
            The tram!
          </PartyChat.Line>
        </PartyChat.List>
        <PartyChat.Composer {...composer} />
      </PartyChat.Root>
    </AppProviders>
  );

describe('apps/client/web: PartyChat', () => {
  it('names the chat for the party', () => {
    renderChat();

    expect(screen.getByRole('region', { name: 'Chat' })).toBeInTheDocument();
  });

  it.each([
    { scenario: 'a line', line: {}, shown: 'The tram!' },
    { scenario: 'a system line', line: { system: true }, shown: 'The tram!' },
    { scenario: 'a hidden author', line: { hidden: true }, shown: 'Hidden message' },
  ])('renders $scenario', ({ line, shown }) => {
    renderChat({ line });

    expect(screen.getByText(shown)).toBeInTheDocument();
  });

  it('reveals one hidden line on "Show anyway"', async () => {
    const onShow = vi.fn();
    renderChat({ line: { hidden: true, onShow } });

    await userEvent.click(screen.getByRole('button', { name: 'Show anyway' }));

    expect(onShow).toHaveBeenCalledOnce();
  });

  it('sends what the viewer typed while the composer is open', async () => {
    const onSend = vi.fn();
    renderChat({ onSend });

    await userEvent.type(screen.getByRole('textbox'), 'hello{Enter}');

    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it.each([
    { state: 'muted', mutedUntil: '20:15', shown: 'You are muted in chat until 20:15' },
    {
      state: 'muted',
      mutedUntil: undefined,
      shown: 'You are muted in chat for the rest of the party',
    },
    { state: 'off', mutedUntil: undefined, shown: 'Chat is off in this party' },
    { state: 'offline', mutedUntil: undefined, shown: 'Chat is read-only while you are offline' },
  ] as const)('replaces the composer when $state ($mutedUntil)', ({ state, mutedUntil, shown }) => {
    renderChat({ composer: { state, mutedUntil } });

    expect(screen.getByText(shown)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('offers a guest the sign-in bar in place of the composer', async () => {
    const onSignIn = vi.fn();
    renderChat({ composer: { state: 'guest', onSignIn } });

    await userEvent.click(screen.getByRole('button', { name: 'Sign in to chat' }));

    expect(onSignIn).toHaveBeenCalledOnce();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('passes axe', async () => {
    renderChat();

    expect(await axeViolations()).toEqual([]);
  });
});
