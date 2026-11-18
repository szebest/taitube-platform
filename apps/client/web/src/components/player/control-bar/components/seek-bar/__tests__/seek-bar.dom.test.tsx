import { fireEvent, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { renderBar } from '#app/components/player/control-bar/__tests__/render-bar';

const CHAPTERS = [
  { startMs: 0, title: 'Intro' },
  { startMs: 150_000, title: 'Middle' },
  { startMs: 450_000, title: 'End' },
];

const seekBar = () => screen.getByRole('slider', { name: 'Seek' });
const markers = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[data-slot="chapter-marker"]')].map(
    (marker) => marker.style.insetInlineStart
  );

describe('apps/client/web: SeekBar', () => {
  it('sizes the track from the playhead and the buffered range', async () => {
    renderBar({ currentTime: 150, duration: 600 });

    await vi.waitFor(() => expect(seekBar().style.getPropertyValue('--played')).toBe('25%'));
    expect(seekBar().style.getPropertyValue('--buffered')).toBe('0%');
  });

  it('seeks to the time the bar moves to', async () => {
    const seek = vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set');
    renderBar({ duration: 600 });
    await vi.waitFor(() => expect(seekBar()).toHaveAttribute('max', '600'));

    fireEvent.change(seekBar(), { target: { value: '30' } });

    expect(seek).toHaveBeenCalledWith(30);
  });

  it('shows only the clip: its own clock and bar, seeking inside it', async () => {
    const seek = vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set');
    const { bar } = renderBar({
      currentTime: 75,
      duration: 600,
      range: { startMs: 60_000, endMs: 90_000 },
    });

    await vi.waitFor(() => expect(bar).toHaveTextContent('00:15 / 00:30'));
    expect(seekBar()).toHaveAttribute('max', '30');

    fireEvent.change(seekBar(), { target: { value: '10' } });

    expect(seek).toHaveBeenCalledWith(70);
  });

  it('marks where each chapter after the first starts', async () => {
    const { container } = renderBar({ duration: 600, chapters: CHAPTERS });

    await vi.waitFor(() => expect(markers(container)).toEqual(['25%', '75%']));
  });

  it.each([
    { name: 'no chapters', chapters: [] },
    { name: 'only a chapter at the start', chapters: CHAPTERS.slice(0, 1) },
  ])('draws no marker for $name', async ({ chapters }) => {
    const { container } = renderBar({ duration: 600, chapters });
    await vi.waitFor(() => expect(seekBar()).toHaveAttribute('max', '600'));

    expect(markers(container)).toEqual([]);
  });

  it('says the chapter the playhead is in along with the time', async () => {
    renderBar({ currentTime: 200, duration: 600, chapters: CHAPTERS });

    await vi.waitFor(() => expect(seekBar()).toHaveAttribute('aria-valuetext', '03:20, Middle'));
  });

  it('keeps the markers out of the accessibility tree and the tab order', async () => {
    const { container } = renderBar({ duration: 600, chapters: CHAPTERS });
    await vi.waitFor(() => expect(markers(container)).toHaveLength(2));

    const decoration = container.querySelector('[data-slot="chapter-marker"]')?.parentElement;

    expect(decoration).toHaveAttribute('aria-hidden', 'true');
    expect(decoration).not.toHaveAttribute('tabindex');
    expect(await axeViolations()).toEqual([]);
  });
});
