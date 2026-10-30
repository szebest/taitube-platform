import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { LinerNotes, LinerNotesSkeleton } from '.';
import { LinerNotesRoot } from './liner-notes';

const THUMB = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#5a2a12"/></svg>'
)}`;

const CHAPTERS = [
  { id: 'arrival', seconds: 0, time: '00:00', title: 'Arrival' },
  { id: 'tram', seconds: 135, time: '02:15', title: 'The tram' },
  { id: 'rain', seconds: 400, time: '06:40', title: 'Rain' },
  { id: 'alfama', seconds: 655, time: '10:55', title: 'Alfama at night' },
  { id: 'dawn', seconds: 920, time: '15:20', title: 'Dawn' },
];

const frame: Decorator = (Story) => (
  <div className="tw:max-w-[48rem] tw:p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/LinerNotes',
  component: LinerNotesRoot,
  args: { onSeek: () => undefined },
  decorators: [frame],
} satisfies Meta<typeof LinerNotesRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const Notes = () => (
  <>
    Shot entirely on a Hi8 camcorder over three nights in Alfama. No music, only the city.{' '}
    <LinerNotes.Timecode seconds={135}>02:15</LinerNotes.Timecode> is the tram.
    {'\n'}Camera: Sony CCD-TRV16. Sound: the camera's own microphone. Edited at{' '}
    <a href="/channel/marta">@martareis</a>, graded by hand.
    {'\n'}Thanks to everyone on the 28 who let me film.
  </>
);

const Chapters = ({ current, thumbs = false }: { current?: string; thumbs?: boolean }) => (
  <LinerNotes.Chapters>
    {CHAPTERS.map(({ id, title, ...chapter }) => (
      <LinerNotes.Chapter
        key={id}
        id={id}
        current={id === current}
        thumbnailSrc={thumbs ? THUMB : undefined}
        {...chapter}
      >
        {title}
      </LinerNotes.Chapter>
    ))}
  </LinerNotes.Chapters>
);

const Meta_ = () => (
  <LinerNotes.Meta>
    412K views · 2 days ago · <a href="/search?q=%23film">#film</a>{' '}
    <a href="/search?q=%23lisbon">#lisbon</a>
  </LinerNotes.Meta>
);

export const Collapsed: Story = {
  render: (args) => (
    <LinerNotes.Root {...args}>
      <Meta_ />
      <LinerNotes.Body>
        <Notes />
      </LinerNotes.Body>
      <Chapters />
    </LinerNotes.Root>
  ),
};

export const ExpandedWithLinksAndTimecodes: Story = {
  args: { expanded: true },
  render: Collapsed.render,
};

export const CurrentChapter: Story = {
  render: (args) => (
    <LinerNotes.Root {...args}>
      <Meta_ />
      <LinerNotes.Body>
        <Notes />
      </LinerNotes.Body>
      <Chapters current="rain" />
    </LinerNotes.Root>
  ),
};

export const ChapterThumbnails: Story = {
  render: (args) => (
    <LinerNotes.Root {...args}>
      <Meta_ />
      <LinerNotes.Body>
        <Notes />
      </LinerNotes.Body>
      <Chapters current="tram" thumbs />
    </LinerNotes.Root>
  ),
};

export const NoChapters: Story = {
  render: (args) => (
    <LinerNotes.Root {...args}>
      <Meta_ />
      <LinerNotes.Body>
        <Notes />
      </LinerNotes.Body>
    </LinerNotes.Root>
  ),
};

export const NoDescription: Story = {
  render: (args) => (
    <LinerNotes.Root {...args}>
      <Meta_ />
    </LinerNotes.Root>
  ),
};

export const LongUnbrokenUrl: Story = {
  render: (args) => (
    <LinerNotes.Root {...args}>
      <Meta_ />
      <LinerNotes.Body>
        Full credits at{' '}
        <a href="/credits">
          https://taitube.local/channel/marta-reis-films/credits/lisbon-trams-no-music-hi8-1998-alfama-three-nights
        </a>
      </LinerNotes.Body>
    </LinerNotes.Root>
  ),
};

export const Flat: Story = {
  args: { layout: 'flat' },
  render: Collapsed.render,
};

export const CompactChapterList: Story = {
  args: { expanded: true },
  globals: { viewport: { value: 'mobile1' } },
  render: CurrentChapter.render,
};

export const RightToLeft: Story = {
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
  render: CurrentChapter.render,
};

export const Skeleton: Story = {
  render: () => <LinerNotesSkeleton />,
};
