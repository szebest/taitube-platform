import { createRoom } from '../watch-party-create';
import {
  OWNER,
  partyBody,
  seedParty,
  userCaller,
  type WatchPartyTestOptions,
  watchPartyTestDeps,
} from './watch-party-test-deps';

export async function setUpCreate(options: WatchPartyTestOptions = {}) {
  const test = watchPartyTestDeps(options);
  await seedParty(test);
  const create = (body = partyBody(), user = OWNER) =>
    createRoom(test.deps, userCaller(user), body);
  return { ...test, create };
}

export type CreateContext = Awaited<ReturnType<typeof setUpCreate>>;

export const OWNER_KEY = `user:${OWNER.id}`;
