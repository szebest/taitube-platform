import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { IntlProvider } from '@vp/queries/intl';
import { ControlBar } from '#app/components/player/control-bar';
import { VideoJsEngine } from '#app/integrations/video-js/video-js-engine';
import { WEB_MESSAGES } from '#app/lib/messages';
import { TimelineMarkerLayer, type TimelineMarker } from '..';

const POSTER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#1b2a3a"/></svg>'
)}`;

const PLAYBACK_URL = 'http://localhost:9000/public/videos/story/hls/master.m3u8';

const MARKERS: TimelineMarker[] = [
  { id: 'twist', atMs: 65_000, title: 'The twist at the tram', replies: 3, count: 1 },
  { id: 'sign', atMs: 190_000, title: 'The second sign', replies: 1, count: 3 },
];

const stage: Decorator = (Story) => (
  <div className="max-w-[40rem] p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/TimelineMarkerLayer',
  tags: ['text', 'translated'],
  component: TimelineMarkerLayer,
  args: { markers: MARKERS, onActivate: () => undefined },
  decorators: [stage],
} satisfies Meta<typeof TimelineMarkerLayer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OnTheSeekBar: Story = {
  render: (args) => (
    <IntlProvider messages={WEB_MESSAGES} locale="en" timeZone="UTC">
      <VideoJsEngine playbackUrl={PLAYBACK_URL} posterUrl={POSTER} title="Lisbon trams">
        <ControlBar title="Lisbon trams" markers={<TimelineMarkerLayer {...args} />} />
      </VideoJsEngine>
    </IntlProvider>
  ),
};

export const InAClip: Story = {
  args: { range: { startMs: 60_000, endMs: 120_000 } },
  render: (args) => (
    <IntlProvider messages={WEB_MESSAGES} locale="en" timeZone="UTC">
      <VideoJsEngine playbackUrl={PLAYBACK_URL} posterUrl={POSTER} title="Lisbon trams">
        <ControlBar
          title="Lisbon trams"
          range={args.range}
          markers={<TimelineMarkerLayer {...args} />}
        />
      </VideoJsEngine>
    </IntlProvider>
  ),
};
