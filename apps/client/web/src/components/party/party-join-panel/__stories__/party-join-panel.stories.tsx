import type { Meta, StoryObj } from '@storybook/react-vite';
import { withPartyIntl } from '#app/components/party/__stories__/with-party-intl';
import { PartyJoinPanel } from '..';

const POSTER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><defs><linearGradient id="g"><stop offset="0" stop-color="#1d2b3a"/><stop offset="1" stop-color="#c9772f"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/></svg>'
)}`;

const meta = {
  title: 'Web/PartyJoinPanel',
  decorators: [withPartyIntl],
  tags: ['text'],
  component: PartyJoinPanel,
  args: {
    state: 'yes',
    name: 'Movie night',
    ownerName: 'Ana',
    videoTitle: 'Big Buck Bunny',
    posterUrl: POSTER,
    faces: [
      { name: 'Ana', avatarUrl: null },
      { name: 'Bruno', avatarUrl: null },
    ],
    total: 7,
    onJoin: () => undefined,
    onWatchAsGuest: () => undefined,
    onDiscord: () => undefined,
    onSignIn: () => undefined,
    onWatchAlone: () => undefined,
  },
} satisfies Meta<typeof PartyJoinPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GuestAndSignIn: Story = { args: { actions: ['guest', 'sign_in'] } };
export const WithDiscord: Story = { args: { actions: ['guest', 'discord', 'sign_in'] } };
export const SignedIn: Story = {};
export const GuestsOff: Story = { args: { state: 'guests_off', actions: ['sign_in'] } };
export const Password: Story = { args: { state: 'password' } };
export const WrongPassword: Story = { args: { state: 'password', passwordError: 'invalid' } };
export const LockedOut: Story = { args: { state: 'password', passwordError: 'locked' } };
export const Full: Story = { args: { state: 'full', full: { present: 10, capacity: 10 } } };
export const Banned: Story = { args: { state: 'banned', actions: [] } };
export const Closed: Story = { args: { state: 'closed' } };
export const NotFound: Story = { args: { state: 'not_found', total: 0 } };
