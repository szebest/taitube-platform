import { axeViolations } from '@kit/web-testing/dom';
import { screen } from '@testing-library/react';
import { renderBar } from '#app/components/player/control-bar/__tests__/render-bar';
import { type TimelineMarker, TimelineMarkerLayer } from '../timeline-marker-layer';

const MARKERS: TimelineMarker[] = [
  { id: 'twist', atMs: 150_000, title: 'The twist at the tram', replies: 3, count: 1 },
  { id: 'cluster', atMs: 450_000, title: 'Left sign', replies: 1, count: 2 },
];

const layer = (
  markers: readonly TimelineMarker[] = MARKERS,
  props: { range?: { startMs: number; endMs: number }; onActivate?: (id: string) => void } = {}
) => (
  <TimelineMarkerLayer
    markers={markers}
    onActivate={props.onActivate ?? vi.fn()}
    range={props.range}
  />
);

const markerButtons = () => screen.findAllByRole('button', { name: /,/ });

describe('apps/client/web: TimelineMarkerLayer', () => {
  it('places each marker along the seek bar by the moment it is about', async () => {
    const { container } = renderBar({ duration: 600, markers: layer() });

    await markerButtons();

    expect(
      [...container.querySelectorAll<HTMLElement>('[data-slot="timeline-marker"]')].map(
        (marker) => marker.style.insetInlineStart
      )
    ).toEqual(['25%', '75%']);
  });

  it('names a marker by its thread and its replies, and badges one that stands for several threads', async () => {
    renderBar({ duration: 600, markers: layer() });

    expect(
      await screen.findByRole('button', { name: 'The twist at the tram, 3 replies' })
    ).toBeInTheDocument();
    const cluster = screen.getByRole('button', { name: 'Left sign, 1 reply' });

    expect(cluster.querySelector('[data-slot="timeline-marker-count"]')).toHaveTextContent('2');
    expect(
      screen
        .getByRole('button', { name: 'The twist at the tram, 3 replies' })
        .querySelector('[data-slot="timeline-marker-count"]')
    ).toBeNull();
  });

  it('carries the title and reply count in a tip that hover and focus reveal', async () => {
    renderBar({ duration: 600, markers: layer() });
    const marker = await screen.findByRole('button', { name: 'Left sign, 1 reply' });

    const tip = marker.querySelector('[data-slot="timeline-marker-tip"]');

    expect(tip).toHaveTextContent('Left sign');
    expect(tip).toHaveTextContent('1 reply');
    expect(tip).toHaveClass('group-hover/marker:block', 'group-focus-visible/marker:block');
  });

  it.each([
    {
      how: 'a click',
      activate: async (user: ReturnType<typeof renderBar>['user'], marker: HTMLElement) =>
        user.click(marker),
    },
    {
      how: 'Enter on the focused marker',
      activate: async (user: ReturnType<typeof renderBar>['user'], marker: HTMLElement) => {
        marker.focus();
        await user.keyboard('{Enter}');
      },
    },
  ])('seeks to the moment and hands the thread over on $how', async ({ activate }) => {
    const seek = vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set');
    const onActivate = vi.fn();
    const { user } = renderBar({ duration: 600, markers: layer(MARKERS, { onActivate }) });

    await activate(
      user,
      await screen.findByRole('button', { name: 'The twist at the tram, 3 replies' })
    );

    expect(seek).toHaveBeenCalledWith(150);
    expect(onActivate).toHaveBeenCalledWith('twist');
  });

  it('draws only the markers inside a clip, measured from its start', async () => {
    const { container } = renderBar({
      duration: 600,
      range: { startMs: 100_000, endMs: 200_000 },
      markers: layer(MARKERS, { range: { startMs: 100_000, endMs: 200_000 } }),
    });

    await markerButtons();

    expect(
      [...container.querySelectorAll<HTMLElement>('[data-slot="timeline-marker"]')].map(
        (marker) => marker.style.insetInlineStart
      )
    ).toEqual(['50%']);
  });

  it('has no accessibility violations', async () => {
    renderBar({ duration: 600, markers: layer() });
    await markerButtons();

    expect(await axeViolations()).toEqual([]);
  });
});
