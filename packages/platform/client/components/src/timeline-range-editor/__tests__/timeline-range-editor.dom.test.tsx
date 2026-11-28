import { axeViolations } from '@kit/web-testing/dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimelineRangeEditor, type TimelineRangeEditorProps } from '../timeline-range-editor';
import type { PositionControl, RangeControl } from '../types';

const SPRITE = {
  url: 'http://localhost:9000/sprites/s.jpg',
  intervalSec: 10,
  columns: 10,
  tileWidth: 160,
  tileHeight: 90,
};

const range = (patch: Partial<RangeControl> = {}): RangeControl => ({
  mode: 'range',
  range: { startMs: 10_000, endMs: 15_000 },
  onRangeChange: vi.fn(),
  minSpanMs: 2_000,
  maxSpanMs: 30_000,
  startLabel: 'Starts at',
  endLabel: 'Ends at',
  ...patch,
});

const position = (patch: Partial<PositionControl> = {}): PositionControl => ({
  mode: 'position',
  positionMs: 20_000,
  onPositionChange: vi.fn(),
  label: 'Playhead',
  ...patch,
});

const renderEditor = (props: Partial<TimelineRangeEditorProps> = {}) =>
  render(
    <TimelineRangeEditor
      aria-label="Timeline"
      durationMs={120_000}
      control={range()}
      summary="0:10 to 0:15"
      {...props}
    />
  );

const markersOf = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[data-slot="timeline-marker"]')].map(
    (marker) => marker.style.insetInlineStart
  );

describe('@kit/components: TimelineRangeEditor', () => {
  it.each([
    {
      name: 'a range',
      control: range(),
      thumbs: [
        ['Starts at', '10'],
        ['Ends at', '15'],
      ],
    },
    { name: 'a position', control: position(), thumbs: [['Playhead', '20']] },
  ])('offers $name as named thumbs holding their seconds', ({ control, thumbs }) => {
    renderEditor({ control });

    expect(
      screen
        .getAllByRole('slider')
        .map((thumb) => [thumb.getAttribute('aria-label'), thumb.getAttribute('aria-valuenow')])
    ).toEqual(thumbs);
  });

  it('says the range in words', () => {
    renderEditor();

    expect(screen.getByText('0:10 to 0:15')).toBeInTheDocument();
  });

  it('reports a range thumb moved a second, keeping the other end', async () => {
    const onRangeChange = vi.fn();
    renderEditor({ control: range({ onRangeChange }) });

    screen.getByRole('slider', { name: 'Ends at' }).focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(onRangeChange).toHaveBeenCalledWith({ startMs: 10_000, endMs: 16_000 });
  });

  it('reports the position in milliseconds', async () => {
    const onPositionChange = vi.fn();
    renderEditor({ control: position({ onPositionChange }) });

    screen.getByRole('slider', { name: 'Playhead' }).focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(onPositionChange).toHaveBeenCalledWith(21_000);
  });

  it('pulls the other end along when a drag would pass the longest range', async () => {
    const onRangeChange = vi.fn();
    renderEditor({
      control: range({
        range: { startMs: 10_000, endMs: 40_000 },
        onRangeChange,
      }),
    });

    screen.getByRole('slider', { name: 'Ends at' }).focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(onRangeChange).toHaveBeenCalledWith({ startMs: 11_000, endMs: 41_000 });
  });

  it.each([
    { name: 'with a sprite', sprite: SPRITE, drawn: true },
    { name: 'without one', sprite: undefined, drawn: false },
  ])('lays frames under the slider $name: $drawn', ({ sprite, drawn }) => {
    const { container } = renderEditor({ sprite });

    expect(container.querySelector('[data-slot="sprite-strip"]') !== null).toBe(drawn);
  });

  it('ticks each marker at its time, marks the active one, and keeps them out of the tab order', () => {
    const { container } = renderEditor({
      markers: [
        { id: 1, ms: 30_000, label: 'Chapter 2 at 0:30' },
        { id: 2, ms: 90_000, label: 'Chapter 3 at 1:30', active: true },
      ],
    });

    const ticks = container.querySelectorAll('[data-slot="timeline-marker"]');

    expect(markersOf(container)).toEqual(['25%', '75%']);
    expect(ticks[1]).toHaveAttribute('data-active');
    expect(ticks[0]?.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it.each([
    { name: 'a range over frames', control: range(), sprite: SPRITE },
    { name: 'a position with markers', control: position(), sprite: undefined },
  ])('has no accessibility violations for $name', async ({ control, sprite }) => {
    renderEditor({ control, sprite, markers: [{ id: 1, ms: 30_000, label: 'Chapter 2' }] });

    expect(await axeViolations()).toEqual([]);
  });
});
