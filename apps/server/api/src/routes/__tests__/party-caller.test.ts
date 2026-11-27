import type { FastifyRequest } from 'fastify';
import { partyCallerOf } from '../party-caller';

describe('partyCallerOf', () => {
  it('hands the services the session, the party credential and the address as the request holds them', () => {
    const user = { id: 'user-1', role: 'USER' } as const;
    const party = {
      principal: { kind: 'guest', guestId: 'abcdefghijklmnop', name: 'Guest 1000' },
      ipHash: 'hash',
    } as const;

    const caller = partyCallerOf({ user, party, ip: '203.0.113.7' } as FastifyRequest);

    expect(caller).toEqual({ user, party, ip: '203.0.113.7' });
  });
});
