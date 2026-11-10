import { useT } from '@vp/intl-react';
import { Tabs } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';
import { PARTY_ROOM_TABS } from './constants';
import { PartyRoomContext, usePartyRoom } from './party-room.context';
import { partyRoomStyles } from './party-room.variants';
import type { PartyRoomLayout, PartyRoomTab } from './types';

function isPartyRoomTab(value: string): value is PartyRoomTab {
  return PARTY_ROOM_TABS.some((tab) => tab.value === value);
}

export interface PartyRoomRootProps extends ComponentPropsWithRef<'div'> {
  /** `side` docks the panel at inline-end from expanded up, `focus` hides it for the chat overlay. */
  layout?: PartyRoomLayout;
}

/** The party page: the room header, the stage, and the panel with Chat, People and Queue. */
export function PartyRoomRoot({ layout = 'side', className, ...props }: PartyRoomRootProps) {
  return (
    <PartyRoomContext value={{ layout }}>
      <div
        data-slot="party-room"
        data-layout={layout}
        className={partyRoomStyles({ layout }).root({ className })}
        {...props}
      />
    </PartyRoomContext>
  );
}

/** The name, owner, phase and count of the room, with its Invite, Settings and Layout actions. */
export function PartyRoomHeader({ className, ...props }: ComponentPropsWithRef<'header'>) {
  const { layout } = usePartyRoom('Header');

  return (
    <header
      data-slot="party-room-header"
      className={partyRoomStyles({ layout }).header({ className })}
      {...props}
    />
  );
}

export function PartyRoomStage({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { layout } = usePartyRoom('Stage');

  return (
    <div
      data-slot="party-room-stage"
      className={partyRoomStyles({ layout }).stage({ className })}
      {...props}
    />
  );
}

/** Drawn over the stage, and inside the player when it goes fullscreen: the focus layout's chat, the reactions. */
export function PartyRoomOverlay({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { layout } = usePartyRoom('Overlay');

  return (
    <div
      data-slot="party-room-overlay"
      className={partyRoomStyles({ layout }).overlay({ className })}
      {...props}
    />
  );
}

export interface PartyRoomPanelProps extends Omit<
  ComponentPropsWithRef<typeof Tabs.Root>,
  'value' | 'onValueChange' | 'orientation' | 'variant' | 'size'
> {
  value: PartyRoomTab;
  onValueChange: (tab: PartyRoomTab) => void;
}

/** The panel beside or below the stage: its tab list and the one tab panel the viewer picked. */
export function PartyRoomPanel({ value, onValueChange, className, ...props }: PartyRoomPanelProps) {
  const { layout } = usePartyRoom('Panel');
  const { tOr } = useT();

  const handleValueChange = (tab: string) => {
    if (isPartyRoomTab(tab)) {
      onValueChange(tab);
    }
  };

  return (
    <aside
      data-slot="party-room-panel"
      aria-label={tOr('party.roomPanel', {}, '')}
      className={partyRoomStyles({ layout }).panel({ className })}
    >
      <Tabs.Root
        value={value}
        onValueChange={handleValueChange}
        className="flex min-h-0 flex-1 flex-col"
        {...props}
      />
    </aside>
  );
}

export function PartyRoomTabs(props: ComponentPropsWithRef<typeof Tabs.List>) {
  const { tOr } = useT();

  return (
    <Tabs.List {...props}>
      {PARTY_ROOM_TABS.map(({ value, label }) => (
        <Tabs.Tab key={value} value={value}>
          {tOr(label, {}, '')}
        </Tabs.Tab>
      ))}
    </Tabs.List>
  );
}

export interface PartyRoomTabPanelProps extends ComponentPropsWithRef<typeof Tabs.Panel> {
  value: PartyRoomTab;
}

export function PartyRoomTabPanel(props: PartyRoomTabPanelProps) {
  return <Tabs.Panel {...props} />;
}
