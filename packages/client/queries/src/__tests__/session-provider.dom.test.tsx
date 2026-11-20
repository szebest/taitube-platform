import { render, screen } from '@testing-library/react';
import { canAccessAdmin, canOwnChannel } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { account } from '@vp/web-testing';
import { useState } from 'react';
import type { Identity } from '../account-slots';
import type { Session } from '../session';
import { SessionProvider, useActingChannelId } from '../session-provider';

const OWNED_CHANNEL = { id: account().channel.id, ownerId: account().user.id };

const MEMBER_CHANNEL = {
  id: '00000000-0000-7000-8000-0000000000c9',
  ownerId: '00000000-0000-7000-8000-0000000000b9',
};

const VIEWER_USER = { ...account().user, id: '00000000-0000-7000-8000-0000000000b2' };

type Step = { identity: Identity; session: Session };

const CREATOR: Step = {
  identity: { slot: 0 },
  session: { status: 'signed-in', account: account() },
};
const CREATOR_ON_MEMBER_CHANNEL: Step = {
  identity: { slot: 0, channel: 'worked-on' },
  session: { status: 'signed-in', account: account(), actingChannelId: MEMBER_CHANNEL.id },
};
const VIEWER: Step = {
  identity: { slot: 1 },
  session: {
    status: 'signed-in',
    account: account({ role: 'USER', user: VIEWER_USER, id: VIEWER_USER.id }),
  },
};
const ADMIN: Step = {
  identity: { slot: 2 },
  session: { status: 'signed-in', account: account({ role: 'ADMIN' }) },
};

/** What a page asks of the channel the tab acts as, on an ability it built when it mounted. */
function Abilities({ mounted }: { mounted: () => number }) {
  const [mount] = useState(mounted);
  const channel = useActingChannelId() === MEMBER_CHANNEL.id ? MEMBER_CHANNEL : OWNED_CHANNEL;
  const owns = useCan(canOwnChannel, { channel });
  const admin = useCan(canAccessAdmin);
  return <p>{`mount ${mount}, owns: ${owns}, admin: ${admin}`}</p>;
}

describe('@vp/queries: SessionProvider across a switch', () => {
  it.each([
    { switch: 'a creator to a plain viewer', from: CREATOR, to: VIEWER, owns: false, admin: false },
    { switch: 'a plain viewer to a creator', from: VIEWER, to: CREATOR, owns: true, admin: false },
    {
      switch: 'an owned to a member channel',
      from: CREATOR,
      to: CREATOR_ON_MEMBER_CHANNEL,
      owns: false,
      admin: false,
    },
    {
      switch: 'a member to an owned channel',
      from: CREATOR_ON_MEMBER_CHANNEL,
      to: CREATOR,
      owns: true,
      admin: false,
    },
    { switch: 'a plain viewer to an admin', from: VIEWER, to: ADMIN, owns: true, admin: true },
  ])(
    'flips useCan from $switch, on an ability mounted afresh for it',
    ({ from, to, owns, admin }) => {
      let mounts = 0;
      const tree = ({ session, identity }: Step) => (
        <SessionProvider session={session} identity={identity}>
          <Abilities mounted={() => (mounts += 1)} />
        </SessionProvider>
      );
      const { rerender } = render(tree(from));

      rerender(tree(to));

      expect(screen.getByText(`mount 2, owns: ${owns}, admin: ${admin}`)).toBeInTheDocument();
    }
  );
});
