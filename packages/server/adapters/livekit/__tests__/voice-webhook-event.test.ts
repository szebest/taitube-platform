import { toVoiceWebhookEvent } from '../voice-webhook-event';

const ROOM = { name: 'party:1' };

describe('adapters/livekit: toVoiceWebhookEvent', () => {
  it.each([
    {
      scenario: 'a join with publish rights',
      wire: {
        event: 'participant_joined',
        room: ROOM,
        participant: { identity: 'user:a', permission: { canPublish: true } },
      },
      expected: {
        type: 'participant_joined',
        room: 'party:1',
        identity: 'user:a',
        canPublish: true,
      },
    },
    {
      scenario: 'a join without a permission',
      wire: { event: 'participant_joined', room: ROOM, participant: { identity: 'user:a' } },
      expected: {
        type: 'participant_joined',
        room: 'party:1',
        identity: 'user:a',
        canPublish: false,
      },
    },
    {
      scenario: 'a leave',
      wire: { event: 'participant_left', room: ROOM, participant: { identity: 'user:a' } },
      expected: { type: 'participant_left', room: 'party:1', identity: 'user:a' },
    },
    {
      scenario: 'an event this repo ignores',
      wire: { event: 'room_finished', room: ROOM },
      expected: { type: 'ignored' },
    },
    {
      scenario: 'a join without a participant',
      wire: { event: 'participant_joined', room: ROOM },
      expected: { type: 'ignored' },
    },
  ])('reads $scenario', ({ wire, expected }) => {
    expect(toVoiceWebhookEvent(wire)).toEqual(expected);
  });
});
