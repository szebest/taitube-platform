import { getWatchParty, joinWatchParty, watchPartySocket } from '@vp/api-contracts';
import { partyHello, partyMembership, partyPreview, partyRoom } from '../party-fixtures';

describe('@vp/web-testing: party fixtures', () => {
  it('builds a hello the socket contract accepts', () => {
    const hello = partyHello();

    expect(hello).toMatchObject({ type: 'hello', room: { phase: 'lobby' } });
    expect(watchPartySocket.result.safeParse(hello).success).toBe(true);
  });

  it('applies overrides to the room', () => {
    expect(partyRoom({ name: 'Late show' }).name).toBe('Late show');
  });

  it('builds a preview and a membership the contracts accept', () => {
    expect(getWatchParty.result.safeParse(partyPreview()).success).toBe(true);
    expect(joinWatchParty.result.safeParse({ membership: partyMembership() }).success).toBe(true);
  });

  it('lets a preview override the viewer one field at a time', () => {
    expect(partyPreview({ viewer: { canJoin: 'full' } }).viewer).toMatchObject({
      canJoin: 'full',
      actions: ['guest', 'sign_in'],
    });
  });
});
