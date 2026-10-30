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

const scrollTo = (log: HTMLElement, scrollTop: number) => {
  Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 600 });
  Object.defineProperty(log, 'clientHeight', { configurable: true, value: 200 });
  log.scrollTop = scrollTop;
  fireEvent.scroll(log);
};

describe('apps/client/web: LiveChatList', () => {
  it.each([
    { scrollTop: 400, following: 'true', jump: false },
    { scrollTop: 100, following: 'false', jump: true },
  ])('follows $following at scrollTop $scrollTop', ({ scrollTop, following, jump }) => {
    const { log } = renderList();

    scrollTo(log, scrollTop);

    expect(log).toHaveAttribute('data-following', following);
    expect(screen.queryByRole('button', { name: 'Jump to latest' }) !== null).toBe(jump);
  });

  it('asks for older messages at the top', () => {
    const { log, onEndReached } = renderList();

    scrollTo(log, 0);

    expect(onEndReached).toHaveBeenCalledOnce();
  });
});
