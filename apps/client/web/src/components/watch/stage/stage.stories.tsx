import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { Stage, StageSkeleton } from '.';
import { StageRoot } from './stage';

const poster = (from: string, to: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><defs><linearGradient id="g"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/></svg>`
  )}`;

const WARM_POSTER = poster('#5a2a12', '#c9772f');
const COOL_POSTER = poster('#dfe9f5', '#7aa7d9');
const WARM_GLOW = ['#c9772f', '#8a3d17', '#e0a458'];
const COOL_GLOW = ['#7aa7d9', '#3d6aa1'];
const VIDEO_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

const frame: Decorator = (Story) => (
  <div className="tw:max-w-[56rem] tw:p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/Stage',
  component: StageRoot,
  args: { videoId: VIDEO_ID, glowColors: WARM_GLOW },
  decorators: [frame],
} satisfies Meta<typeof StageRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WarmGlow: Story = {
  render: (args) => (
    <Stage.Root {...args}>
      <Stage.Glow />
      <Stage.Poster src={WARM_POSTER} alt="Lisbon trams, no music" />
    </Stage.Root>
  ),
};

export const CoolGlowBrightPoster: Story = {
  args: { glowColors: COOL_GLOW },
  render: (args) => (
    <Stage.Root {...args}>
      <Stage.Glow />
      <Stage.Poster src={COOL_POSTER} alt="Alfama at 5 a.m." />
    </Stage.Root>
  ),
};

export const Paused: Story = {
  args: { paused: true },
  render: WarmGlow.render,
};

export const Theater: Story = {
  args: { variant: 'theater' },
  render: WarmGlow.render,
};

export const Vertical: Story = {
  args: { variant: 'vertical' },
  decorators: [
    (Story) => (
      <div className="tw:max-w-[20rem]">
        <Story />
      </div>
    ),
  ],
  render: WarmGlow.render,
};

export const LoadingWithPoster: Story = {
  render: (args) => (
    <Stage.Root {...args}>
      <Stage.Glow />
      <Stage.Poster src={WARM_POSTER} alt="Lisbon trams, no music" />
      <Stage.Status kind="loading" />
    </Stage.Root>
  ),
};

export const ErrorWithRetry: Story = {
  render: (args) => (
    <Stage.Root {...args}>
      <Stage.Status kind="error" onRetry={() => undefined}>
        This video could not be played.
      </Stage.Status>
    </Stage.Root>
  ),
};

export const Unavailable: Story = {
  args: { glowColors: undefined },
  render: (args) => (
    <Stage.Root {...args}>
      <Stage.Status kind="unavailable">This video is private.</Stage.Status>
    </Stage.Root>
  ),
};

export const AmbientOff: Story = {
  decorators: [
    (Story) => (
      <div data-ambient="off">
        <Story />
      </div>
    ),
  ],
  render: WarmGlow.render,
};

export const CompactSticky: Story = {
  globals: { viewport: { value: 'mobile1' } },
  render: (args) => (
    <div className="tw:h-[200vh]">
      <Stage.Root {...args}>
        <Stage.Glow />
        <Stage.Poster src={WARM_POSTER} alt="Lisbon trams, no music" />
      </Stage.Root>
    </div>
  ),
};

export const Banner: Story = {
  args: { variant: 'banner', videoId: undefined },
  render: (args) => (
    <Stage.Root {...args}>
      <Stage.Glow />
      <img
        src={poster('#3b2414', '#a15a26')}
        alt=""
        className="tw:block tw:aspect-[21/6] tw:w-full tw:rounded-card tw:object-cover"
      />
    </Stage.Root>
  ),
};

export const Skeleton: Story = {
  render: () => <StageSkeleton />,
};
