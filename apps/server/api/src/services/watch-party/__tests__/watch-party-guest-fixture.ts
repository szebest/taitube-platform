import { expectOk } from '@vp/testing/result';
import { WatchPartyGuestService } from '../watch-party-guest-service';
import {
  GUEST_IP,
  type PartyBodyOverrides,
  seedParty,
  startParty,
  type WatchPartyTestOptions,
  watchPartyTestDeps,
} from './watch-party-test-deps';

export async function setUpGuests(
  body: PartyBodyOverrides = {},
  options: WatchPartyTestOptions = {}
) {
  const test = watchPartyTestDeps(options);
  await seedParty(test);
  const room = await startParty(test, body);
  const service = new WatchPartyGuestService(test.deps);
  const join = (ip = GUEST_IP, guestBody?: { invite?: string }, roomId = room.id) =>
    service.join(roomId, { user: null, party: null, ip }, guestBody);
  const seated = async () =>
    expectOk(await test.repositories.watchPartyMembers.listSeated(room.id));
  return { ...test, room, service, join, seated };
}

export type Guests = Awaited<ReturnType<typeof setUpGuests>>;

export async function guestJoined(guests: Guests, ip = GUEST_IP) {
  const joined = expectOk(await guests.join(ip));
  const session = expectOk(await guests.guestSessions.resolve(joined.credential, 60));
  return { joined, session: session ?? never() };
}

function never(): never {
  throw new Error('the credential did not resolve');
}
