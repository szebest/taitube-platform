import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ClipEditor, type ClipEditorSprite, type ClipEditorValue } from '.';
import { ClipEditorRoot } from './clip-editor';

const SHEET = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="180" viewBox="0 0 10 1"><defs><linearGradient id="g"><stop offset="0" stop-color="#8a3d17"/><stop offset="1" stop-color="#17508a"/></linearGradient></defs><rect width="10" height="1" fill="url(#g)"/></svg>'
)}`;

const SPRITE: ClipEditorSprite = {
  url: SHEET,
  intervalSec: 10,
  columns: 10,
  tileWidth: 160,
  tileHeight: 90,
};

const clock = (ms: number) =>
  `${Math.floor(ms / 60_000)}:${String((ms / 1000) % 60).padStart(2, '0')}`;

function Editor({ sprite, initial }: { sprite?: ClipEditorSprite; initial: ClipEditorValue }) {
  const [range, setRange] = useState(initial);

  return (
    <ClipEditor.Root durationMs={120_000} range={range} onRangeChange={setRange}>
      <ClipEditor.Preview aria-label="Preview of the clip" />
      <ClipEditor.Range
        aria-label="Clip range"
        sprite={sprite}
        startLabel="Clip start"
        endLabel="Clip end"
        summary={`${clock(range.startMs)} to ${clock(range.endMs)}`}
      />
    </ClipEditor.Root>
  );
}

const frame: Decorator = (Story) => (
  <div className="tw:max-w-[40rem] tw:p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/ClipEditor',
  component: ClipEditorRoot,
  args: {
    durationMs: 120_000,
    range: { startMs: 20_000, endMs: 40_000 },
    onRangeChange: () => undefined,
  },
  decorators: [frame],
} satisfies Meta<typeof ClipEditorRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OverFrames: Story = {
  render: () => <Editor sprite={SPRITE} initial={{ startMs: 20_000, endMs: 40_000 }} />,
};

export const WithoutSprite: Story = {
  render: () => <Editor initial={{ startMs: 20_000, endMs: 40_000 }} />,
};

export const LongestRange: Story = {
  render: () => <Editor sprite={SPRITE} initial={{ startMs: 10_000, endMs: 70_000 }} />,
};

export const ShortestRange: Story = {
  render: () => <Editor sprite={SPRITE} initial={{ startMs: 60_000, endMs: 65_000 }} />,
};
