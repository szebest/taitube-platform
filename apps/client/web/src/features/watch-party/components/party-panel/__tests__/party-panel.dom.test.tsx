import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import {
  assignWatchPartyRole,
  kickWatchPartyMember,
  type PersonalControlView,
  putWatchPartyControl,
  type WatchPartyRoleView,
} from '@vp/api-contracts';
import type { WatchPartyViewer } from '@vp/permissions';
import type { PartyChatLine, WatchPartyState } from '@vp/queries';
import {
  apiServer,
  mockEndpoint,
  PARTY_ID,
  PARTY_OWNER_KEY,
  PARTY_VIEWER_KEY,
} from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { PartyRoom, type PartyRoomTab } from '#app/components/party/party-room';
import { partyState } from '#app/features/watch-party/__tests__/party-state';
import { partyViewer, renderParty } from '#app/features/watch-party/__tests__/render-party';
import { PartyPanel } from '../party-panel';

const MODERATOR_ROLE_ID = '0190c3a0-5e1d-7000-8000-000000009401';
const BRUNO_KEY = 'user:0190c3a0-5e1d-7000-8000-000000009103';
const MUTED_ROLE_ID = '0190c3a0-5e1d-7000-8000-000000009402';
const VOICE_MUTED_ROLE_ID = '0190c3a0-5e1d-7000-8000-000000009403';
const LINE_ID = '0190c3a0-5e1d-7000-8000-000000009511';
const LINE_ID_2 = '0190c3a0-5e1d-7000-8000-000000009512';

const CONTROL = (overrides: Partial<PersonalControlView> = {}): PersonalControlView => ({
  targetKey: BRUNO_KEY,
  roomId: PARTY_ID,
  voiceMuted: false,
  volume: 100,
  hideMessages: false,
  hideReactions: false,
  hideAvatar: false,
  hideRequests: false,
  blockInvites: false,
  favourite: false,
  ...overrides,
});

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
    voice = false,
    controls = [],
  }: {
    tab?: PartyRoomTab;
    viewer?: WatchPartyViewer;
    voice?: boolean;
    controls?: PersonalControlView[];
  } = {}
) {
  const send = vi.fn(() => true);
  const onSignIn = vi.fn();
  const view = renderParty(
    <PartyRoom.Root>
      <PartyPanel
        roomId={PARTY_ID}
        socket={{
          state: partyState(state),
          serverNow: () => 0,
          send,
          dismissRequest: () => undefined,
        }}
        tab={tab}
        onTabChange={vi.fn()}
        onSignIn={onSignIn}
        voice={voice}
      />
    </PartyRoom.Root>,
    viewer,
    controls
  );

  return { send, onSignIn, unmount: view.unmount };
}

describe('apps/client/web: PartyPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

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

  it('mutes a member in voice with the voice-muted role, never the chat-muted one', async () => {
    const chatMuted = ROLE({
      id: MUTED_ROLE_ID,
      key: 'chat_muted',
      kind: 'restrict',
      colour: null,
      position: 520,
    });
    const voiceMuted = ROLE({
      id: VOICE_MUTED_ROLE_ID,
      key: 'voice_muted',
      kind: 'restrict',
      colour: null,
      position: 510,
    });
    const assigned: unknown[] = [];
    apiServer.use(
      mockEndpoint(assignWatchPartyRole, ({ params }) => {
        assigned.push(params.roleId);
        return new HttpResponse(null, { status: 204 });
      })
    );
    renderPanel(
      { ...withBruno(), roles: [chatMuted, voiceMuted] },
      { tab: 'people', voice: true, viewer: partyViewer(['voice.moderate'], { topPosition: 50 }) }
    );

    await userEvent.click(screen.getByRole('button', { name: 'Options for Bruno' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mute in voice' }));
    await userEvent.keyboard('{ArrowRight}{Enter}');

    await vi.waitFor(() => expect(assigned).toEqual([VOICE_MUTED_ROLE_ID]));
  });

  it("hides a member's lines for the viewer until Show anyway reveals one", async () => {
    renderPanel(
      {
        ...withBruno(),
        lines: [
          LINE({
            id: LINE_ID,
            author: { memberKey: BRUNO_KEY, name: 'Bruno', avatarUrl: null },
            body: 'Secret',
          }),
          LINE({
            id: LINE_ID_2,
            author: { memberKey: BRUNO_KEY, name: 'Bruno', avatarUrl: null },
            body: 'Again',
          }),
        ],
      },
      { controls: [CONTROL({ hideMessages: true })] }
    );

    expect(await screen.findAllByText('Hidden message')).toHaveLength(2);
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();

    const [firstShow] = screen.getAllByRole('button', { name: 'Show anyway' }).slice(0, 1);
    await userEvent.click(firstShow ?? screen.getByRole('button', { name: 'Show anyway' }));

    expect(screen.getByText('Secret')).toBeInTheDocument();
    expect(screen.queryByText('Again')).not.toBeInTheDocument();
  });

  it('saves a room control for an account in this room, and an everywhere one for everywhere', async () => {
    const saved: unknown[] = [];
    apiServer.use(
      mockEndpoint(putWatchPartyControl, async ({ request }) => {
        saved.push(await request.json());
        return HttpResponse.json({ items: [] });
      })
    );
    renderPanel(withBruno(), { tab: 'people' });

    await userEvent.click(screen.getByRole('button', { name: 'Options for Bruno' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'In this room' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Hide messages' }));

    await vi.waitFor(() =>
      expect(saved).toEqual([
        expect.objectContaining({ targetKey: BRUNO_KEY, roomId: PARTY_ID, hideMessages: true }),
      ])
    );

    await userEvent.click(screen.getByRole('button', { name: 'Options for Bruno' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Everywhere' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Block invites' }));

    await vi.waitFor(() =>
      expect(saved[1]).toEqual(
        expect.objectContaining({ targetKey: BRUNO_KEY, roomId: null, blockInvites: true })
      )
    );
  });

  it('marks a hidden member in the roster and clears it with one click', async () => {
    const saved: unknown[] = [];
    apiServer.use(
      mockEndpoint(putWatchPartyControl, async ({ request }) => {
        saved.push(await request.json());
        return HttpResponse.json({ items: [] });
      })
    );
    renderPanel(withBruno(), { tab: 'people', controls: [CONTROL({ hideMessages: true })] });

    expect(await screen.findByText('Hidden by you')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo for Bruno' }));

    await vi.waitFor(() =>
      expect(saved).toEqual([
        expect.objectContaining({ targetKey: BRUNO_KEY, roomId: PARTY_ID, hideMessages: false }),
      ])
    );
  });

  it("keeps a guest's room-only controls in the browser, across a reload, with no everywhere scope", async () => {
    const guest: Partial<WatchPartyState> = {
      you: { memberKey: 'guest:aGuestIdOfSixteenChars', kind: 'guest', roleIds: [] },
    };
    const first = renderPanel(
      { ...withBruno(), ...guest },
      { tab: 'people', viewer: partyViewer([], { kind: 'guest' }) }
    );

    await userEvent.click(screen.getByRole('button', { name: 'Options for Bruno' }));
    expect(screen.getByRole('menuitem', { name: 'Everywhere (needs an account)' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'In this room' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Hide messages' }));
    first.unmount();

    renderPanel(
      { ...withBruno(), ...guest },
      { tab: 'people', viewer: partyViewer([], { kind: 'guest' }) }
    );

    expect(await screen.findByText('Hidden by you')).toBeInTheDocument();
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
