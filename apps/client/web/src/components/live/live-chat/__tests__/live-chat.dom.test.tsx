import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import type { ReactNode } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import { LiveChat, LiveChatSkeleton } from '..';
import type { LiveChatRootProps } from '../live-chat';

const LINES = ['The tram!', 'Is this the 28?'];

const lines = (shown: string[]) =>
  shown.map((line) => (
    <LiveChat.Message key={line} author="ines">
      {line}
    </LiveChat.Message>
  ));

function renderChat({
  props = {},
  messages = lines(LINES),
  composer = <LiveChat.Composer maxLength={10} />,
}: {
  props?: Partial<LiveChatRootProps>;
  messages?: ReactNode;
  composer?: ReactNode;
} = {}) {
  const onSend = vi.fn();
  const tree = (shown: ReactNode) => (
    <AppProviders>
      <LiveChat.Root onSend={onSend} {...props}>
        <LiveChat.Header>
          <h2>Live chat</h2>
          <LiveChat.Menu>
            <LiveChat.Opacity />
          </LiveChat.Menu>
        </LiveChat.Header>
        <LiveChat.List>{shown}</LiveChat.List>
        {composer}
      </LiveChat.Root>
    </AppProviders>
  );
  const rendered = render(tree(messages));
  return {
    ...rendered,
    user: userEvent.setup(),
    onSend,
    showMessages: (shown: ReactNode) => rendered.rerender(tree(shown)),
  };
}

function scrollLog(scrollTop: number) {
  const log = screen.getByRole('log');
  Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 600 });
  Object.defineProperty(log, 'clientHeight', { configurable: true, value: 200 });
  log.scrollTop = scrollTop;
  fireEvent.scroll(log);
}

describe('apps/client/web: LiveChat', () => {
  it.each([
    { label: 'Enter', typed: '  hello  {Enter}', sent: ['hello'] },
    { label: 'Enter on blank words', typed: '   {Enter}', sent: [] },
    { label: 'Shift Enter', typed: 'hi{Shift>}{Enter}{/Shift}', sent: [] },
  ])('sends the trimmed words on $label', async ({ typed, sent }) => {
    const { user, onSend } = renderChat();

    await user.type(screen.getByRole('textbox', { name: 'Say something' }), typed);

    expect(onSend.mock.calls.map(([text]) => text)).toEqual(sent);
  });

  it('clears the field after sending from the send button', async () => {
    const { user, onSend } = renderChat();
    const field = screen.getByRole('textbox', { name: 'Say something' });

    await user.type(field, 'hello');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(onSend).toHaveBeenCalledWith('hello');
    expect(field).toHaveValue('');
  });

  it('counts the characters once the message nears its limit', async () => {
    const { user } = renderChat();
    const field = screen.getByRole('textbox', { name: 'Say something' });

    await user.type(field, 'abcdefg');
    expect(screen.queryByText('7 / 10')).not.toBeInTheDocument();

    await user.type(field, 'h');
    expect(screen.getByText('8 / 10')).toBeInTheDocument();
  });

  it('waits in slow mode, with the countdown in place of sending', () => {
    renderChat({ composer: <LiveChat.Composer wait="Send again in 12 seconds" /> });

    expect(screen.getByRole('textbox', { name: 'Say something' })).toBeDisabled();
    expect(screen.getByText('Send again in 12 seconds')).toBeInTheDocument();
  });

  it.each([
    { state: 'removed', shown: 'Message removed', hidden: 'The tram!' },
    { state: 'pending', shown: 'Sending', hidden: undefined },
    { state: 'failed', shown: 'Not sent', hidden: undefined },
  ] as const)('marks a $state message in words', ({ state, shown, hidden }) => {
    renderChat({
      messages: (
        <LiveChat.Message author="ines" state={state}>
          The tram!
        </LiveChat.Message>
      ),
    });

    expect(screen.getByText(shown)).toBeInTheDocument();
    if (hidden) {
      expect(screen.queryByText(hidden)).not.toBeInTheDocument();
    }
  });

  it('offers a retry beside a failed message', async () => {
    const onRetry = vi.fn();
    const { user } = renderChat({
      messages: (
        <LiveChat.Message author="ines" state="failed" onRetry={onRetry}>
          The tram!
        </LiveChat.Message>
      ),
    });

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalled();
  });

  it.each([
    { role: 'creator', badge: 'Creator' },
    { role: 'moderator', badge: 'Moderator' },
  ] as const)('names a $role in text, not colour alone', ({ role, badge }) => {
    renderChat({
      messages: (
        <LiveChat.Message author="marta" role={role}>
          Hello
        </LiveChat.Message>
      ),
    });

    expect(screen.getByRole('listitem')).toHaveTextContent(`${badge}marta`);
  });

  it('keeps the log quiet until the viewer asks for new messages aloud', async () => {
    const { user } = renderChat();

    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'off');

    await user.click(screen.getByRole('button', { name: 'Chat options' }));
    await user.click(screen.getByRole('switch', { name: 'Read new messages aloud' }));

    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
  });

  it.each([
    { layout: 'docked', slider: false },
    { layout: 'overlay', slider: true },
  ] as const)(
    'offers the opacity slider only when $layout is overlay',
    async ({ layout, slider }) => {
      const { user } = renderChat({ props: { layout } });

      await user.click(screen.getByRole('button', { name: 'Chat options' }));

      expect(screen.queryByRole('slider', { name: 'Chat opacity' }) !== null).toBe(slider);
    }
  );

  it('stops following when scrolled up, counts what arrives, and jumps back to the latest', async () => {
    const { user, showMessages } = renderChat();

    scrollLog(400);
    scrollLog(100);
    showMessages(lines([...LINES, 'Hello from Porto']));
    const jump = await screen.findByRole('button', { name: /Jump to latest/ });
    expect(jump).toHaveTextContent('Jump to latest1');
    await user.click(jump);

    expect(screen.queryByRole('button', { name: /Jump to latest/ })).not.toBeInTheDocument();
    expect(screen.getByRole('log')).toHaveAttribute('data-following', 'true');
  });

  it('asks for older messages at the top of the log', () => {
    const onEndReached = vi.fn();
    renderChat({ props: { onEndReached } });

    scrollLog(0);

    expect(onEndReached).toHaveBeenCalled();
  });

  it('names a part used outside its root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<LiveChat.Pinned>Pinned</LiveChat.Pinned>)).toThrow(
      'LiveChat.Pinned must be inside LiveChat.Root'
    );
  });

  it('passes axe, loaded and as a skeleton', async () => {
    renderChat({ props: { layout: 'overlay' } });
    render(<LiveChatSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
