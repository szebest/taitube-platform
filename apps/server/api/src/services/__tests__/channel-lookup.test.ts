import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { claimFreeHandle, findChannelByIdOrHandle } from '../channel-lookup';

const USER = '018f0000-0000-7000-8000-000000000001';
const CHANNEL = '018f0000-0000-7000-8000-000000000002';

describe('apps/server/api/services: findChannelByIdOrHandle', () => {
  let repositories: InMemoryRepositories;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    expectOk(
      await repositories.channels.create({
        id: CHANNEL,
        userId: USER,
        handle: 'creator',
        displayName: 'Creator',
      })
    );
  });

  it.each([
    { scenario: 'the channel id', key: CHANNEL },
    { scenario: 'the handle', key: 'creator' },
    { scenario: 'the handle with its at sign', key: '@creator' },
  ])('finds a channel by $scenario', async ({ key }) => {
    const found = expectOk(await findChannelByIdOrHandle(repositories.channels, key));

    expect(found.id).toBe(CHANNEL);
  });

  it.each([
    { scenario: 'an unknown id', key: '018f0000-0000-7000-8000-0000000000ff' },
    { scenario: 'an unknown handle', key: 'nobody' },
  ])('answers CHANNEL_NOT_FOUND for $scenario', async ({ key }) => {
    const failure = expectErr(await findChannelByIdOrHandle(repositories.channels, key));

    expect(failure).toMatchObject({ code: ErrorCodes.CHANNEL_NOT_FOUND, idOrHandle: key });
  });
});

describe('apps/server/api/services: claimFreeHandle', () => {
  it('derives the handle from the email when no channel holds it', async () => {
    const repositories = new InMemoryRepositories();

    const handle = expectOk(await claimFreeHandle(repositories.channels, 'ada@example.com', USER));

    expect(handle).toMatch(/^ada/);
  });

  it('moves on to the next candidate once a channel holds the first', async () => {
    const repositories = new InMemoryRepositories();
    const first = expectOk(await claimFreeHandle(repositories.channels, 'ada@example.com', USER));
    expectOk(
      await repositories.channels.create({
        id: CHANNEL,
        userId: USER,
        handle: first,
        displayName: 'Ada',
      })
    );

    const next = expectOk(await claimFreeHandle(repositories.channels, 'ada@example.com', USER));

    expect(next).not.toBe(first);
  });
});
