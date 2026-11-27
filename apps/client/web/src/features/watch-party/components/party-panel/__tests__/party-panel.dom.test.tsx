import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import {
  assignWatchPartyRole,
  kickWatchPartyMember,
  type WatchPartyRoleView,
} from '@vp/api-contracts';
import type { WatchPartyViewer } from '@vp/permissions';
import type { PartyChatLine, WatchPartyState } from '@vp/queries';
import { apiServer, mockEndpoint, PARTY_OWNER_KEY, PARTY_VIEWER_KEY } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { PartyRoom, type PartyRoomTab } from '#app/components/party/party-room';
import { partyState } from '#app/features/watch-party/__tests__/party-state';
import { partyViewer, renderParty } from '#app/features/watch-party/__tests__/render-party';
import { PartyPanel } from '../party-panel';

const MODERATOR_ROLE_ID = '0190c3a0-5e1d-7000-8000-000000009401';
const BRUNO_KEY = 'user:0190c3a0-5e1d-7000-8000-000000009103';
const MUTED_ROLE_ID = '0190c3a0-5e1d-7000-8000-000000009402';

const ROLE = (overrides: Partial<WatchPartyRoleView>): WatchPartyRoleView => ({
  id: MODERATOR_ROLE_ID,
  key: 'moderator',
  kind: 'grant',
  name: 'Moderator',
  colour: '#c9772f',
  position: 60,
  permissions: [],
  memberCount: 1,
  updatedAt: '2026-11-05T10:00:00.000Z',
  ...overrides,
});

const LINE = (overrides: Partial<PartyChatLine> = {}): PartyChatLine => ({
  id: '0190c3a0-5e1d-7000-8000-000000009501',
  author: { memberKey: PARTY_OWNER_KEY, name: 'Ana', avatarUrl: null },
  source: 'app',
  kind: 'text',
  body: 'Starting in a minute',
  system: null,
  videoId: null,
  positionMs: null,
  pinned: false,
  createdAt: '2026-11-05T10:00:00.000Z',
  ...overrides,
});

function withBruno(): Partial<WatchPartyState> {
  const { roster } = partyState();

  return {
    roster: [
      ...roster,
      {
        memberKey: BRUNO_KEY,
        kind: 'user',
        source: 'app',
        name: 'Bruno',
        avatarUrl: null,
        roleIds: [],
        ready: false,
        sync: 'in_sync',
        voice: 'off',
        away: false,
      },
    ],
  };
}

function renderPanel(
  state: Partial<WatchPartyState> = {},
  {
    tab = 'chat',
    viewer = partyViewer(['chat.post']),
  }: { tab?: PartyRoomTab; viewer?: WatchPartyViewer } = {}
) {
  const send = vi.fn(() => true);
  const onSignIn = vi.fn();
  renderParty(
    <PartyRoom.Root>
      <PartyPanel
        roomId="room-1"
        socket={{
          state: partyState(state),
          serverNow: () => 0,
          send,
          dismissRequest: () => undefined,
        }}
        tab={tab}
        onTabChange={vi.fn()}
        onSignIn={onSignIn}
      />
    </PartyRoom.Root>,
    viewer
  );

  return { send, onSignIn };
}

describe('apps/client/web: PartyPanel', () => {
  it('shows the chat lines, with the author role badges in their colours, and the system lines apart', () => {
    const moderator = ROLE({});
    const state = partyState();
    renderPanel({
      roles: [moderator],
      roster: state.roster.map((person) =>
        person.memberKey === PARTY_OWNER_KEY ? { ...person, roleIds: [moderator.id] } : person
      ),
      lines: [
        LINE(),
        LINE({
          id: '0190c3a0-5e1d-7000-8000-000000009502',
          author: null,
          kind: 'system',
          body: 'Bruno joined',
        }),
      ],
    });

    expect(screen.getByText('Starting in a minute')).toBeInTheDocument();
    expect(screen.getByText('Moderator')).toHaveStyle({ color: '#c9772f' });
    expect(screen.getByText('Bruno joined').closest('li')).toHaveAttribute('data-system');
  });

  it('sends what the viewer types as a chat frame', async () => {
    const { send } = renderPanel();

    await userEvent.type(screen.getByRole('textbox'), 'hello{Enter}');

    expect(send).toHaveBeenCalledWith({ type: 'chat.send', message: 'hello' });
  });

  it.each([
    {
      scenario: 'a guest gets the sign-in bar',
      state: { you: { memberKey: 'guest:aGuestIdOfSixteenChars', kind: 'guest', roleIds: [] } },
      shown: 'Sign in to chat',
    },
    {
      scenario: 'a closed socket makes chat read-only',
      state: { connection: 'closed' },
      shown: 'Chat is read-only while you are offline',
    },
    {
      scenario: 'a room with chat off says so',
      state: { chatMode: { enabled: false, slowModeSeconds: 0 } },
      shown: 'Chat is off in this party',
    },
  ] as const)('$scenario', ({ state, shown }) => {
    renderPanel(state as Partial<WatchPartyState>);

    expect(screen.getByText(shown)).toBeInTheDocument();
  });

  it('replaces the composer with the mute and its end for a muted viewer', () => {
    const muted = ROLE({
      id: MUTED_ROLE_ID,
      key: 'chat_muted',
      kind: 'restrict',
      colour: null,
      position: 520,
    });
    renderPanel({
      roles: [muted],
      you: { memberKey: PARTY_VIEWER_KEY, kind: 'user', roleIds: [muted.id] },
      expiries: { [muted.id]: '2026-11-05T20:15:00.000Z' },
    });

    expect(screen.getByText(/You are muted in chat until/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('groups the roster as present and away, with guests as a count, and offers no menu on the viewer', () => {
    const state = partyState();
    renderPanel(
      {
        roster: state.roster.map((person) =>
          person.memberKey === PARTY_OWNER_KEY ? { ...person, away: true } : person
        ),
        guests: 3,
      },
      { tab: 'people' }
    );

    expect(screen.getByRole('heading', { name: /Present/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Away/ })).toBeInTheDocument();
    expect(screen.getByText('3 guests')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Options for Me' })).not.toBeInTheDocument();
  });

  it('kicks a member below the viewer from the member menu', async () => {
    const kicked: unknown[] = [];
    apiServer.use(
      mockEndpoint(kickWatchPartyMember, ({ params }) => {
        kicked.push(params.memberKey);
        return new HttpResponse(null, { status: 204 });
      })
    );
    renderPanel(withBruno(), {
      tab: 'people',
      viewer: partyViewer(['members.kick'], { topPosition: 50 }),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Options for Bruno' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Kick' }));

    await vi.waitFor(() => expect(kicked).toEqual([BRUNO_KEY]));
  });

  it('mutes a member in chat with the chat-muted role and the picked duration', async () => {
    const muted = ROLE({
      id: MUTED_ROLE_ID,
      key: 'chat_muted',
      kind: 'restrict',
      colour: null,
      position: 520,
    });
    const assigned: unknown[] = [];
    apiServer.use(
      mockEndpoint(assignWatchPartyRole, async ({ params, request }) => {
        assigned.push({ roleId: params.roleId, body: await request.json() });
        return new HttpResponse(null, { status: 204 });
      })
    );
    renderPanel(
      { ...withBruno(), roles: [muted] },
      { tab: 'people', viewer: partyViewer(['chat.moderate'], { topPosition: 50 }) }
    );

    await userEvent.click(screen.getByRole('button', { name: 'Options for Bruno' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mute in chat' }));
    await userEvent.keyboard('{ArrowRight}{Enter}');

    await vi.waitFor(() =>
      expect(assigned).toEqual([{ roleId: MUTED_ROLE_ID, body: { expiresIn: '10m' } }])
    );
  });

  it('lists the queue, naming who added each item, and says when it is empty', () => {
    const state = partyState();
    const { queue } = renderQueue(state);

    expect(within(queue).getByText('Added by Ana')).toBeInTheDocument();
  });

  it('says the queue is empty', () => {
    renderPanel({}, { tab: 'queue' });

    expect(screen.getByText('The queue is empty')).toBeInTheDocument();
  });
});

function renderQueue(state: WatchPartyState) {
  renderPanel(
    {
      queue: {
        version: 2,
        items: [
          {
            id: '0190c3a0-5e1d-7000-8000-000000009201',
            video: { id: 'v1', title: 'Sintel', durationMs: 600_000, thumbnailUrl: null },
            addedBy: PARTY_OWNER_KEY,
            startMs: 0,
            playedAt: null,
          },
        ],
      },
      roster: state.roster,
    },
    { tab: 'queue' }
  );

  return { queue: screen.getByRole('region', { name: 'Queue' }) };
}
