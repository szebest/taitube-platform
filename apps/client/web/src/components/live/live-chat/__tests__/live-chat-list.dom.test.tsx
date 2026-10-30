import { fireEvent, render, screen } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import { LiveChatRoot } from '../live-chat';
import { LiveChatList } from '../live-chat-list';

const renderList = (onEndReached = vi.fn()) => {
  render(
    <AppProviders>
      <LiveChatRoot onSend={vi.fn()} onEndReached={onEndReached}>
        <LiveChatList>
          <li>The tram!</li>
        </LiveChatList>
      </LiveChatRoot>
    </AppProviders>
  );
  return { onEndReached, log: screen.getByRole('log') };
};

const scrollTo = (log: HTMLElement, scrollTop: number, scrollHeight = 600) => {
  Object.defineProperty(log, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(log, 'clientHeight', { configurable: true, value: 200 });
  log.scrollTop = scrollTop;
  fireEvent.scroll(log);
};

describe('apps/client/web: LiveChatList', () => {
  it.each([
    { name: 'scrolls to the end', from: 100, to: 400, height: 600, following: 'true', jump: false },
    { name: 'scrolls up', from: 400, to: 100, height: 600, following: 'false', jump: true },
    {
      name: 'grows under the viewer',
      from: 400,
      to: 400,
      height: 900,
      following: 'true',
      jump: false,
    },
  ])('follows $following when the log $name', ({ from, to, height, following, jump }) => {
    const { log } = renderList();

    scrollTo(log, from);
    scrollTo(log, to, height);

    expect(log).toHaveAttribute('data-following', following);
    expect(screen.queryByRole('button', { name: 'Jump to latest' }) !== null).toBe(jump);
  });

  it('asks for older messages at the top', () => {
    const { log, onEndReached } = renderList();

    scrollTo(log, 0);

    expect(onEndReached).toHaveBeenCalledOnce();
  });
});
