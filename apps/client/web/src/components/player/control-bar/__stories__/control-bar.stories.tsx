import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { IntlProvider } from '@vp/intl-react';
import { VideoJsEngine } from '#app/integrations/video-js/video-js-engine';
import { ControlBar } from '..';

const frame = (markup: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9">${markup}</svg>`
  )}`;

const BLACK_FRAME = frame('<rect width="16" height="9" fill="#000"/>');
const BRIGHT_FRAME = frame('<rect width="16" height="9" fill="#fff"/>');
const MIXED_FRAME = frame(
  '<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/><rect y="4" width="16" height="2" fill="#808080"/>'
);

const PLAYBACK_URL = 'http://localhost:9000/public/videos/story/hls/master.m3u8';

const stage: Decorator = (Story) => (
  <div className="max-w-[40rem] p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/ControlBar',
  tags: ['text'],
  component: ControlBar,
  args: { title: 'Lisbon trams, no music' },
  decorators: [stage],
} satisfies Meta<typeof ControlBar>;

export default meta;

type Story = StoryObj<typeof meta>;

const onFrame = (posterUrl: string): Story => ({
  render: (args) => (
    <IntlProvider locale="en" timeZone="UTC">
      <VideoJsEngine playbackUrl={PLAYBACK_URL} posterUrl={posterUrl} title={args.title ?? null}>
        <ControlBar {...args} />
      </VideoJsEngine>
    </IntlProvider>
  ),
});

export const OnBlackFrame: Story = onFrame(BLACK_FRAME);

export const OnBrightFrame: Story = onFrame(BRIGHT_FRAME);

export const OnMixedFrame: Story = onFrame(MIXED_FRAME);

export const LiveOnBrightFrame: Story = {
  ...onFrame(BRIGHT_FRAME),
  args: { live: true },
  tags: ['translated'],
};
