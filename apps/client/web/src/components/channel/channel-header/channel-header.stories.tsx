import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@vp/ui';
import type { ReactNode } from 'react';
import { ChannelHeader, ChannelHeaderSkeleton } from '.';
import { ChannelHeaderRoot, type ChannelHeaderRootProps } from './channel-header';

const picture = (viewBox: string, from: string, to: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><defs><linearGradient id="g"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  )}`;

const BANNER = picture('0 0 60 10', 'saddlebrown', 'sandybrown');
const AVATAR = picture('0 0 1 1', 'darkslateblue', 'cornflowerblue');
const GLOW = 'sienna';

const ALL_TABS = ['Home', 'Videos', 'Shorts', 'Live', 'Playlists', 'Community', 'About'];

interface StoryHeaderProps extends ChannelHeaderRootProps {
  banner?: boolean;
  tabs?: string[];
  name?: string;
  handle?: string;
  live?: boolean;
  actions?: ReactNode;
}

function StoryHeader({
  banner = true,
  tabs = ALL_TABS,
  name = 'Marta Reis Films',
  handle = '@martareis',
  live = false,
  actions = (
    <ChannelHeader.Subscribe subscribed={false} onClick={() => undefined}>
      Subscribe
    </ChannelHeader.Subscribe>
  ),
  ...props
}: StoryHeaderProps) {
  return (
    <ChannelHeader.Root {...props}>
      {banner ? <ChannelHeader.Banner src={BANNER} /> : <ChannelHeader.Banner />}
      <ChannelHeader.Identity
        name={name}
        handle={handle}
        avatarSrc={AVATAR}
        stats="284K subscribers · 86 videos"
        verified
        live={live}
      >
        <ChannelHeader.Bio more={<a href="#about">more</a>}>
          Short films shot on tape, mostly at night. Trams, rain on tiles and the people still out
          when the city goes quiet.
        </ChannelHeader.Bio>
        <ChannelHeader.Actions>{actions}</ChannelHeader.Actions>
      </ChannelHeader.Identity>
      <ChannelHeader.Tabs>
        {tabs.map((tab, index) => (
          <ChannelHeader.Tab key={tab} href={`#${tab.toLowerCase()}`} active={index === 0}>
            {tab}
          </ChannelHeader.Tab>
        ))}
      </ChannelHeader.Tabs>
    </ChannelHeader.Root>
  );
}

const meta = {
  title: 'Web/ChannelHeader',
  component: ChannelHeaderRoot,
  parameters: { layout: 'padded' },
  args: { glowColor: GLOW },
} satisfies Meta<typeof ChannelHeaderRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FullWithBanner: Story = {
  render: (args) => <StoryHeader {...args} />,
};

export const GradientFallback: Story = {
  render: (args) => <StoryHeader {...args} banner={false} />,
};

export const SubscribedWithBell: Story = {
  render: (args) => (
    <StoryHeader
      {...args}
      actions={
        <>
          <ChannelHeader.Subscribe subscribed>Subscribed</ChannelHeader.Subscribe>
          <ChannelHeader.Bell />
        </>
      }
    />
  ),
};

export const Pending: Story = {
  render: (args) => (
    <StoryHeader
      {...args}
      actions={
        <ChannelHeader.Subscribe subscribed pending>
          Subscribed
        </ChannelHeader.Subscribe>
      }
    />
  ),
};

export const Live: Story = {
  render: (args) => <StoryHeader {...args} live />,
};

export const OwnChannel: Story = {
  render: (args) => (
    <StoryHeader
      {...args}
      actions={
        <Button asChild variant="outline">
          <a href="#studio">Open in Studio</a>
        </Button>
      }
    />
  ),
};

export const LongNameAndHandle: Story = {
  render: (args) => (
    <StoryHeader
      {...args}
      name="The Extremely Patient Society for Night Trams, Wet Tiles and Other Quiet Things"
      handle="@theextremelypatientsocietyfornighttrams"
    />
  ),
};

export const ShippedTabsOnly: Story = {
  render: (args) => <StoryHeader {...args} tabs={['Home', 'Videos', 'About']} />,
};

export const Identity: Story = {
  args: { layout: 'identity' },
  render: (args) => <StoryHeader {...args} />,
};

export const Compact: Story = {
  render: (args) => (
    <div className="tw:max-w-[22.5rem]">
      <StoryHeader {...args} />
    </div>
  ),
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: (args) => <StoryHeader {...args} />,
};

export const Skeleton: Story = {
  render: () => (
    <div className="tw:flex tw:flex-col tw:gap-section">
      <ChannelHeaderSkeleton />
      <ChannelHeaderSkeleton layout="identity" />
    </div>
  ),
};
