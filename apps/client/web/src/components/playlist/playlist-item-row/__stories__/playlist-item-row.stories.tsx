import { VideoCard } from '@kit/components';
import { Icon, IconButton, SortableList, Tooltip } from '@kit/ui';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { PlaylistItemRow, PlaylistItemRowSkeleton, PlaylistSectionRow } from '..';

const POSTER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#5a2a12"/></svg>'
)}`;

const AVATAR = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#2f4a5c"/></svg>'
)}`;

const LONG_TITLE =
  'The extremely patient society for night trams, wet tiles and other quiet things, part four of an unreasonably long series';

const LONG_NOTE =
  'Watch this one with the sound off first. The second half is a single take through the Alfama at five in the morning and the street noise carries it, so go back and listen once you have seen the pictures. Skip the intro.';

const noop = () => undefined;

const Video = ({
  id,
  title,
  channel = 'Marta Reis Films',
}: {
  id: string;
  title: string;
  channel?: string;
}) => (
  <VideoCard.Root variant="row" size="sm" videoId={id}>
    <VideoCard.Thumb src={POSTER} duration="18:42" />
    <VideoCard.Title asChild>
      <a href={`/watch/${id}`}>{title}</a>
    </VideoCard.Title>
    <VideoCard.Meta>{channel}</VideoCard.Meta>
  </VideoCard.Root>
);

const list: Decorator = (Story) => (
  <Tooltip.Provider>
    <SortableList.Root
      items={['row']}
      onReorder={noop}
      aria-label="Videos"
      className="max-w-[40rem] p-section"
    >
      <SortableList.Item id="row" aria-label="Lisbon trams">
        <Story />
      </SortableList.Item>
    </SortableList.Root>
  </Tooltip.Provider>
);

const meta = {
  title: 'Web/PlaylistItemRow',
  tags: ['text'],
  component: PlaylistItemRow.Root,
  decorators: [list],
} satisfies Meta<typeof PlaylistItemRow.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Plain: Story = {
  render: (args) => (
    <PlaylistItemRow.Root {...args}>
      <PlaylistItemRow.Body>
        <Video id="v1" title="Lisbon trams, no music" />
      </PlaylistItemRow.Body>
    </PlaylistItemRow.Root>
  ),
};

export const WithAdder: Story = {
  render: (args) => (
    <PlaylistItemRow.Root {...args}>
      <PlaylistItemRow.Body>
        <Video id="v1" title="Lisbon trams, no music" />
      </PlaylistItemRow.Body>
      <PlaylistItemRow.Adder src={AVATAR} name="Ana Costa" label="Added by Ana Costa" />
    </PlaylistItemRow.Root>
  ),
};

export const WithNoteAndSegment: Story = {
  render: (args) => (
    <PlaylistItemRow.Root {...args}>
      <PlaylistItemRow.Body>
        <Video id="v1" title="Lisbon trams, no music" />
      </PlaylistItemRow.Body>
      <PlaylistItemRow.Note>Watch with the sound off</PlaylistItemRow.Note>
      <PlaylistItemRow.Segment>0:30 to 1:45</PlaylistItemRow.Segment>
      <PlaylistItemRow.Adder src={undefined} name="Ana Costa" label="Added by Ana Costa" />
    </PlaylistItemRow.Root>
  ),
};

function SelectableRow() {
  const [checked, setChecked] = useState(true);

  return (
    <PlaylistItemRow.Root selected={checked}>
      <PlaylistItemRow.Select
        aria-label="Select Lisbon trams, no music"
        checked={checked}
        onCheckedChange={setChecked}
      />
      <PlaylistItemRow.Body>
        <Video id="v1" title="Lisbon trams, no music" />
      </PlaylistItemRow.Body>
      <PlaylistItemRow.Adder src={AVATAR} name="Ana Costa" label="Added by Ana Costa" />
    </PlaylistItemRow.Root>
  );
}

function FoldableSection() {
  const [folded, setFolded] = useState(false);

  return (
    <div className="max-w-[40rem] p-section">
      <PlaylistSectionRow.Root folded={folded} onFoldedChange={setFolded}>
        <PlaylistSectionRow.Title>Night trams</PlaylistSectionRow.Title>
        <PlaylistSectionRow.Count>4 videos</PlaylistSectionRow.Count>
        <PlaylistSectionRow.Actions>
          <IconButton size="sm" aria-label="Section options">
            <Icon name="more" />
          </IconButton>
        </PlaylistSectionRow.Actions>
      </PlaylistSectionRow.Root>
    </div>
  );
}

export const SelectedForBulkEdit: Story = { render: () => <SelectableRow /> };

export const LongTitleAndLongNote: Story = {
  render: (args) => (
    <PlaylistItemRow.Root {...args}>
      <PlaylistItemRow.Select aria-label="Select" checked={false} onCheckedChange={noop} />
      <PlaylistItemRow.Body>
        <Video
          id="v2"
          title={LONG_TITLE}
          channel="The Extremely Patient Society for Night Trams, Wet Tiles and Other Quiet Things"
        />
      </PlaylistItemRow.Body>
      <PlaylistItemRow.Note>{LONG_NOTE}</PlaylistItemRow.Note>
      <PlaylistItemRow.Segment>12:30 to 1:02:45</PlaylistItemRow.Segment>
      <PlaylistItemRow.Adder src={AVATAR} name="Ana Costa" label="Added by Ana Costa" />
    </PlaylistItemRow.Root>
  ),
};

export const Skeleton: Story = {
  render: () => <PlaylistItemRowSkeleton />,
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: (args) => (
    <PlaylistItemRow.Root {...args}>
      <PlaylistItemRow.Select aria-label="تحديد" checked={false} onCheckedChange={noop} />
      <PlaylistItemRow.Body>
        <Video id="v3" title="ترام لشبونة في الليل" channel="أفلام مارتا" />
      </PlaylistItemRow.Body>
      <PlaylistItemRow.Note>شاهده بدون صوت أولا</PlaylistItemRow.Note>
      <PlaylistItemRow.Segment>0:30 إلى 1:45</PlaylistItemRow.Segment>
      <PlaylistItemRow.Adder src={undefined} name="منى" label="أضافه منى" />
    </PlaylistItemRow.Root>
  ),
};

export const SectionRow: Story = {
  decorators: [],
  render: () => <FoldableSection />,
};

export const SectionRowFolded: Story = {
  decorators: [],
  render: () => (
    <div className="max-w-[40rem] p-section">
      <PlaylistSectionRow.Root folded onFoldedChange={noop}>
        <PlaylistSectionRow.Title>{LONG_TITLE}</PlaylistSectionRow.Title>
        <PlaylistSectionRow.Count>12 videos</PlaylistSectionRow.Count>
      </PlaylistSectionRow.Root>
    </div>
  ),
};
