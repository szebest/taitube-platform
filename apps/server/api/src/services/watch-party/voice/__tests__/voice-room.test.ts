import { roomIdOfVoiceRoom, voiceRoomOf } from '../voice-room';

describe('apps/api: voice room names', () => {
  it('names one voice room per party and reads the party back from it', () => {
    expect(roomIdOfVoiceRoom(voiceRoomOf('abc'))).toBe('abc');
    expect(roomIdOfVoiceRoom('someone-elses-room')).toBeNull();
  });
});
