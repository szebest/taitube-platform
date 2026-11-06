import { render } from '@testing-library/react';
import { createPortal } from 'react-dom';

import type { LiveChatLayout } from '#app/components/live/live-chat';
import { useChatDock } from '../use-chat-dock';

function Docks({ place }: { place: LiveChatLayout }) {
  const { host, dockedRef, overlayRef } = useChatDock(place);

  return (
    <>
      <div data-testid="docked" ref={dockedRef} />
      <div data-testid="overlay" ref={overlayRef} />
      {host && createPortal(<p>The chat</p>, host)}
    </>
  );
}

const renderDocks = (place: LiveChatLayout) => render(<Docks place={place} />);

describe('apps/client/web: useChatDock', () => {
  it('moves the same chat element into the slot of the place it is in', () => {
    const { getByTestId, getByText, rerender } = renderDocks('docked');
    const chat = getByText('The chat');

    expect(getByTestId('docked')).toContainElement(chat);

    rerender(<Docks place="overlay" />);

    expect(getByTestId('overlay')).toContainElement(chat);
    expect(getByText('The chat')).toBe(chat);
  });
});
