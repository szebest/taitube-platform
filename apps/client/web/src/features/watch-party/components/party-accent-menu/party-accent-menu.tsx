import { Button, Icon, Popover } from '@kit/ui';
import { PartyCan } from '@vp/permissions-react';
import { useFailureToast, type WatchPartySocket } from '@vp/queries';
import { RoomAccentPicker } from '#app/components/party/room-accent-picker';
import { usePartyRoomEdit } from '#app/features/watch-party/hooks/use-party-room-edit';
import { useT } from '#app/lib/messages';

interface PartyAccentMenuProps {
  roomId: string;
  socket: WatchPartySocket;
}

/** "Accent" in the room header, for `room.edit`: the picker over the room's current colour. */
export function PartyAccentMenu({ roomId, socket }: PartyAccentMenuProps) {
  const { tOr } = useT();
  const edit = usePartyRoomEdit(roomId);
  const showFailure = useFailureToast();
  const { room } = socket.state;

  if (!room) {
    return null;
  }

  return (
    <PartyCan gate={{ kind: 'permission', permission: 'room.edit' }}>
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button size="sm" variant="ghost">
            <Icon name="sun" size="sm" />
            {tOr('party.accentTitle', {}, '')}
          </Button>
        </Popover.Trigger>
        <Popover.Content>
          <RoomAccentPicker
            value={room.accent}
            onChange={(accent) =>
              edit.mutate(
                { version: room.version, accent },
                { onError: (error) => showFailure(tOr('party.accentFailed', {}, ''), error) }
              )
            }
          />
        </Popover.Content>
      </Popover.Root>
    </PartyCan>
  );
}
