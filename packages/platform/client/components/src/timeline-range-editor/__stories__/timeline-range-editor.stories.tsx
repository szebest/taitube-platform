import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TimelineRangeEditor } from '../timeline-range-editor';
import type { TimelineRange } from '../types';

const SHEET = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="180" viewBox="0 0 10 1"><defs><linearGradient id="g"><stop offset="0" stop-color="#8a3d17"/><stop offset="1" stop-color="#17508a"/></linearGradient></defs><rect width="10" height="1" fill="url(#g)"/></svg>'
)}`;

const sprite = { url: SHEET, intervalSec: 10, columns: 10, tileWidth: 160, tileHeight: 90 };

const meta = {
  title: 'Components/TimelineRangeEditor',
  component: TimelineRangeEditor,
  args: {
    'aria-label': 'Timeline',
    durationMs: 100_000,
    sprite,
    summary: '',
    control: {
      mode: 'position',
      positionMs: 0,
      onPositionChange: () => undefined,
      label: 'Playhead',
    },
  },
} satisfies Meta<typeof TimelineRangeEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

function RangeEditor() {
  const [range, setRange] = useState<TimelineRange>({ startMs: 10_000, endMs: 20_000 });

  return (
    <TimelineRangeEditor
      aria-label="Correction range"
      durationMs={100_000}
      sprite={sprite}
      summary={`${range.startMs / 1000} to ${range.endMs / 1000} seconds`}
      control={{
        mode: 'range',
        range,
        onRangeChange: setRange,
        minSpanMs: 2_000,
        maxSpanMs: 30_000,
        startLabel: 'Starts at',
        endLabel: 'Ends at',
      }}
    />
  );
}

function PositionEditor() {
  const [positionMs, setPositionMs] = useState(35_000);

  return (
    <TimelineRangeEditor
      aria-label="Chapter timeline"
      durationMs={100_000}
      sprite={sprite}
      summary={`Playhead at ${positionMs / 1000} seconds`}
      markers={[
        { id: 1, ms: 30_000, label: 'Chapter 2' },
        { id: 2, ms: 70_000, label: 'Chapter 3', active: true },
      ]}
      control={{ mode: 'position', positionMs, onPositionChange: setPositionMs, label: 'Playhead' }}
    />
  );
}

export const Range: Story = { render: () => <RangeEditor /> };

export const PositionWithMarkers: Story = { render: () => <PositionEditor /> };

export const WithoutFrames: Story = {
  render: () => (
    <TimelineRangeEditor
      aria-label="Timeline"
      durationMs={100_000}
      summary="No frames yet"
      control={{
        mode: 'position',
        positionMs: 10_000,
        onPositionChange: () => undefined,
        label: 'Playhead',
      }}
    />
  ),
};
