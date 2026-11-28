const PREFIX = 'party:';

/** One voice room per watch party. */
export const voiceRoomOf = (roomId: string): string => `${PREFIX}${roomId}`;

export function roomIdOfVoiceRoom(voiceRoom: string): string | null {
  return voiceRoom.startsWith(PREFIX) ? voiceRoom.slice(PREFIX.length) : null;
}
