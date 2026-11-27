import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { UserContext } from '@vp/permissions';
import { PermissionsProvider } from '@vp/permissions-react';
import { createQueryClient } from '@vp/queries';
import { CHANNEL_ID, OWNER_ID } from '@vp/web-testing';
import type { PropsWithChildren } from 'react';
import { comment, OTHER_ID, viewerAccount } from '#app/__tests__/comment-fixtures';
import { signedIn } from '#app/__tests__/providers';
import { useModerationChoices } from '../use-moderation-choices';

const OWNER: UserContext = { id: OWNER_ID, role: 'USER' };
const MODERATOR: UserContext = {
  id: OTHER_ID,
  role: 'USER',
  memberships: { [CHANNEL_ID]: { ownerId: OWNER_ID, role: 'moderator' } },
};
const ANALYST: UserContext = {
  id: OTHER_ID,
  role: 'USER',
  memberships: { [CHANNEL_ID]: { ownerId: OWNER_ID, role: 'analytics' } },
};

const USER_ACTIONS = ['shadow_ban', 'ban', 'lift'];

function choicesFor(
  viewer: UserContext | null,
  top: Parameters<typeof comment>[0] = {},
  scope: { channelId: string | undefined } = { channelId: CHANNEL_ID }
) {
  const Session = signedIn(viewerAccount(viewer?.id ?? OTHER_ID));
  const queryClient = createQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <Session>
        <PermissionsProvider userContext={viewer}>{children}</PermissionsProvider>
      </Session>
    </QueryClientProvider>
  );

  return renderHook(
    () => useModerationChoices(comment(top), { videoOwnerId: OWNER_ID, ...scope }),
    { wrapper }
  ).result.current;
}

describe('apps/client/web: useModerationChoices', () => {
  it.each([
    { name: 'published', top: {}, choices: ['hold', 'hide', 'remove'] },
    { name: 'held', top: { status: 'held' }, choices: ['approve', 'remove'] },
    { name: 'hidden', top: { status: 'hidden' }, choices: ['unhide', 'remove'] },
  ] as const)(
    'offers the owner of a $name comment $choices and the user actions',
    ({ top, choices }) => {
      expect(choicesFor(OWNER, top)).toEqual([...choices, ...USER_ACTIONS]);
    }
  );

  it('gives a channel moderator what the owner has', () => {
    expect(choicesFor(MODERATOR)).toEqual(['hold', 'hide', 'remove', ...USER_ACTIONS]);
  });

  it.each([
    { name: 'a team member who does not moderate', viewer: ANALYST },
    { name: 'a guest', viewer: null },
  ])('offers $name nothing', ({ viewer }) => {
    expect(choicesFor(viewer)).toEqual([]);
  });

  it.each([
    { why: 'the video has no channel', channelId: undefined, top: {} },
    {
      why: 'the author is the creator',
      channelId: CHANNEL_ID,
      top: { author: { ...comment().author, isCreator: true } },
    },
    {
      why: 'the author is the viewer',
      channelId: CHANNEL_ID,
      top: { author: { ...comment().author, userId: OWNER_ID } },
    },
  ])('leaves out the user actions when $why', ({ channelId, top }) => {
    expect(choicesFor(OWNER, top, { channelId })).toEqual(['hold', 'hide', 'remove']);
  });
});
