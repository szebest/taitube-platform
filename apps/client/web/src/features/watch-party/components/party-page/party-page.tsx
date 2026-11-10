import { useSuspenseQuery } from '@tanstack/react-query';
import { useParams, useSearch } from '@tanstack/react-router';
import { useApi, watchPartyPreviewQueryOptions } from '@vp/queries';
import { PartyJoin } from '../party-join/party-join';
import { PartyRoomView } from '../party-room-view/party-room-view';

function Party({ roomId, invite }: { roomId: string; invite?: string }) {
  const api = useApi();
  const { data: preview } = useSuspenseQuery(watchPartyPreviewQueryOptions(api, roomId, invite));

  if (preview.viewer.canJoin === 'member') {
    return <PartyRoomView roomId={roomId} preview={preview} />;
  }

  return <PartyJoin roomId={roomId} preview={preview} invite={invite} />;
}

/** `/parties/$roomId`: the preview for a visitor with no seat, the room for a member. */
export function PartyPage() {
  const { roomId } = useParams({ from: '/parties/$roomId' });
  const { invite } = useSearch({ from: '/parties/$roomId' });

  return <Party key={roomId} roomId={roomId} invite={invite} />;
}
