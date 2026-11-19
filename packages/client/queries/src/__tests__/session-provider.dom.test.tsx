import { render, screen } from '@testing-library/react';
import { canAccessAdmin, canOwnChannel } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { account } from '@vp/web-testing';
import { useState } from 'react';
import type { Identity } from '../account-slots';
import type { Session } from '../session';
import { SessionProvider } from '../session-provider';

const OWNED_CHANNEL = { id: account().channel.id, ownerId: account().user.id };

const MEMBER = { ...account().user, id: '00000000-0000-7000-8000-0000000000b2' };

type Step = { identity: Identity; session: Session };

const CREATOR: Step = {
  identity: { slot: 0 },
  session: { status: 'signed-in', account: account() },
};
const VIEWER: Step = {
  identity: { slot: 1 },
  session: { status: 'signed-in', account: account({ role: 'USER', user: MEMBER, id: MEMBER.id }) },
};
const VIEWER_ON_MEMBER_CHANNEL: Step = { ...VIEWER, identity: { slot: 1, channel: 'worked-on' } };
const ADMIN: Step = {
  identity: { slot: 2 },
  session: { status: 'signed-in', account: account({ role: 'ADMIN' }) },
};

function Abilities({ mounted }: { mounted: () => number }) {
  const [mount] = useState(mounted);
  const owns = useCan(canOwnChannel, { channel: OWNED_CHANNEL });
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
      to: VIEWER_ON_MEMBER_CHANNEL,
      owns: false,
      admin: false,
    },
    {
      switch: 'a member channel to an admin',
      from: VIEWER_ON_MEMBER_CHANNEL,
      to: ADMIN,
      owns: true,
      admin: true,
    },
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
