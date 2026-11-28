import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { IntlProvider } from '@vp/queries/intl';
import { type ReactNode, useEffect } from 'react';
import { WEB_MESSAGES } from '#app/lib/messages';
import { PlayerChannelProvider, useOfferedPlayerChannel } from '#app/lib/player/player-channel';
import type { PlayerCard } from '#app/lib/player/taitube-player-props';
import { PlayerCardLayer } from '..';

const PICTURE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#1d2b3a"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/></svg>'
)}`;

function PlayheadAt({ seconds }: { seconds: number }) {
  const channel = useOfferedPlayerChannel();

  useEffect(() => {
    channel?.publish(seconds);
  }, [channel, seconds]);

  return null;
}

function Frame({ seconds, children }: { seconds: number; children: ReactNode }) {
  return (
    <PlayerChannelProvider>
      <PlayheadAt seconds={seconds} />
      <div className="relative aspect-video w-full overflow-hidden rounded-thumb bg-media font-sans">
        <img src={PICTURE} alt="" className="size-full object-cover" />
        {children}
      </div>
    </PlayerChannelProvider>
  );
}

const stage: Decorator = (Story) => (
  <div className="max-w-[40rem] p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/PlayerCardLayer',
  tags: ['text'],
  component: PlayerCardLayer,
  decorators: [stage],
} satisfies Meta<typeof PlayerCardLayer>;

export default meta;

type Story = StoryObj<typeof meta>;

const card = (overrides: Partial<PlayerCard> = {}): PlayerCard => ({
  id: 'a',
  startMs: 10_000,
  endMs: 15_000,
  text: 'It costs 5 dollars, not 50',
  ...overrides,
});

const at = (seconds: number): Pick<Story, 'render'> => ({
  render: (args) => (
    <IntlProvider messages={WEB_MESSAGES} locale="en" timeZone="UTC">
      <Frame seconds={seconds}>
        <PlayerCardLayer {...args} />
      </Frame>
    </IntlProvider>
  ),
});

export const ShortCard: Story = { ...at(11), args: { cards: [card()] } };

export const LongCard: Story = {
  ...at(11),
  args: {
    cards: [
      card({
        text: 'The tram in the second shot is the 28, not the 12: the 12 stops at Alfama and never climbs to Graça, which is why the route on the map is drawn the way it is.',
      }),
    ],
  },
};

export const OverlappingCardsShowTheFirst: Story = {
  ...at(13),
  args: {
    cards: [card(), card({ id: 'b', startMs: 12_000, endMs: 20_000, text: 'The year is 2026' })],
  },
  tags: ['translated'],
};

export const BetweenCards: Story = { ...at(5), args: { cards: [card()] } };
