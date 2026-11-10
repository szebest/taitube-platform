import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { PartyRoom, type PartyRoomPanelProps, type PartyRoomRootProps } from '..';

interface Setup extends Partial<PartyRoomRootProps> {
  tab?: PartyRoomPanelProps['value'];
  onTabChange?: PartyRoomPanelProps['onValueChange'];
}

const renderPartyRoom = ({ tab = 'chat', onTabChange = vi.fn(), ...root }: Setup = {}) =>
  render(
    <AppProviders>
      <PartyRoom.Root {...root}>
        <PartyRoom.Header>
          <h1>Movie night</h1>
        </PartyRoom.Header>
        <PartyRoom.Stage>
          Stage
          <PartyRoom.Overlay>Overlay</PartyRoom.Overlay>
        </PartyRoom.Stage>
        <PartyRoom.Panel value={tab} onValueChange={onTabChange}>
          <PartyRoom.Tabs />
          <PartyRoom.TabPanel value="chat">Chat panel</PartyRoom.TabPanel>
          <PartyRoom.TabPanel value="people">People panel</PartyRoom.TabPanel>
          <PartyRoom.TabPanel value="queue">Queue panel</PartyRoom.TabPanel>
        </PartyRoom.Panel>
      </PartyRoom.Root>
    </AppProviders>
  );

describe('apps/client/web: PartyRoom', () => {
  it.each([
    { layout: 'side', tab: 'chat', shown: 'Chat panel' },
    { layout: 'below', tab: 'people', shown: 'People panel' },
    { layout: 'theater', tab: 'queue', shown: 'Queue panel' },
    { layout: 'focus', tab: 'chat', shown: 'Chat panel' },
  ] as const)('marks the $layout layout and shows the $tab tab', ({ layout, tab, shown }) => {
    const { container } = renderPartyRoom({ layout, tab });

    expect(container.querySelector('[data-slot="party-room"]')).toHaveAttribute(
      'data-layout',
      layout
    );
    expect(screen.getByText(shown)).toBeInTheDocument();
  });

  it('names the three tabs and reports the one picked', async () => {
    const onTabChange = vi.fn();
    renderPartyRoom({ onTabChange });

    await userEvent.click(screen.getByRole('tab', { name: 'People' }));

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Chat',
      'People',
      'Queue',
    ]);
    expect(onTabChange).toHaveBeenCalledWith('people');
  });

  it('passes axe', async () => {
    renderPartyRoom();

    expect(await axeViolations()).toEqual([]);
  });
});
