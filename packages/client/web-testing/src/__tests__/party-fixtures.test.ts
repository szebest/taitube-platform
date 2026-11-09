import { watchPartySocket } from '@vp/api-contracts';
import { partyHello, partyRoom } from '../party-fixtures';

describe('@vp/web-testing: party fixtures', () => {
  it('builds a hello the socket contract accepts', () => {
    const hello = partyHello();

    expect(hello).toMatchObject({ type: 'hello', room: { phase: 'lobby' } });
    expect(watchPartySocket.result.safeParse(hello).success).toBe(true);
  });

  it('applies overrides to the room', () => {
    expect(partyRoom({ name: 'Late show' }).name).toBe('Late show');
  });
});
