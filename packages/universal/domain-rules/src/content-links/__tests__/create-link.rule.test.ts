import { isErr, isOk } from '@kit/result';
import { NO_ANCHORS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type CreateLinkInput, decideCreateLink } from '../create-link.rule';

const owner: UserContext = { id: 'owner-1', role: 'CREATOR' };
const member = (role: 'editor' | 'moderator'): UserContext => ({
  id: `member-${role}`,
  role: 'USER',
  memberships: { c1: { role, ownerId: owner.id } },
});

const input = (over: Partial<CreateLinkInput> = {}): CreateLinkInput => ({
  actor: owner,
  relation: 'full_video',
  source: {
    ref: { type: 'video', id: 'short' },
    channelId: 'c1',
    ownerId: owner.id,
    anchor: { type: 'video', durationMs: 30_000 },
  },
  target: {
    ref: { type: 'video', id: 'full' },
    channelId: 'c1',
    ownerId: owner.id,
    anchor: { type: 'video', durationMs: 600_000 },
    policy: 'approve',
    public: true,
  },
  anchors: { ...NO_ANCHORS, targetStartMs: 201_000 },
  outgoing: 0,
  channelTotal: 0,
  chainEdges: new Map(),
  ...over,
});

describe('@vp/domain-rules: decideCreateLink', () => {
  it.each([
    { scenario: 'the owner', actor: owner },
    { scenario: 'an editor', actor: member('editor') },
  ])('$scenario links a Short to its full video at 3:21, active at once', ({ actor }) => {
    const result = decideCreateLink(input({ actor }));
    expect(isOk(result) && result.value).toMatchObject({
      status: 'active',
      anchors: { targetStartMs: 201_000 },
    });
  });

  it.each([
    { scenario: 'a moderator', over: { actor: member('moderator') }, code: ErrorCodes.FORBIDDEN },
    { scenario: 'a 21st outgoing link', over: { outgoing: 20 }, code: ErrorCodes.LINK_LIMIT },
    {
      scenario: 'a bad anchor',
      over: { anchors: { ...NO_ANCHORS, targetStartMs: 700_000 } },
      code: ErrorCodes.LINK_ANCHOR_INVALID,
    },
  ])('refuses $scenario with $code', ({ over, code }) => {
    const result = decideCreateLink(input(over));
    expect(isErr(result) && result.error.code).toBe(code);
  });
});
