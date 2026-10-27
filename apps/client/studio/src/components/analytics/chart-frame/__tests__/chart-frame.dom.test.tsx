import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { variantNames } from '@vp/ui';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { ChartFrame, ChartSkeleton, chartFrameStyles, useChartFrame } from '..';
import type { ChartFrameRootProps } from '../chart-frame';

function IsolatedProbe() {
  const { isolated } = useChartFrame();
  return <output aria-label="isolated">{isolated ?? 'none'}</output>;
}

const heightOf = (element: Element | null) =>
  [...(element?.classList ?? [])].find((name) => name.startsWith('tw:h-'));

const renderFrame = (props: ChartFrameRootProps = {}) =>
  render(
    <AppProviders>
      <ChartFrame.Root {...props}>
        <ChartFrame.Title>Views per day</ChartFrame.Title>
        <ChartFrame.Legend>
          <ChartFrame.LegendItem series={0}>Views</ChartFrame.LegendItem>
          <ChartFrame.LegendItem series={1}>Watch time</ChartFrame.LegendItem>
        </ChartFrame.Legend>
        <ChartFrame.Plot>
          <svg role="img" aria-label="Chart drawing" />
        </ChartFrame.Plot>
        <ChartFrame.Description>Views rose 8 percent over 28 days</ChartFrame.Description>
        <IsolatedProbe />
      </ChartFrame.Root>
    </AppProviders>
  );

describe('apps/client/studio: ChartFrame', () => {
  it('captions the figure with its title and describes it by its text alternative', () => {
    renderFrame();

    const figure = screen.getByRole('figure');

    expect(figure.firstElementChild).toEqual(
      screen.getByText('Views per day', { selector: 'figcaption' })
    );
    expect(figure).toHaveAccessibleDescription('Views rose 8 percent over 28 days');
    expect(screen.getByRole('img', { name: 'Chart drawing' })).toBeInTheDocument();
  });

  it('isolates a series from its legend toggle and shows them all again on a second press', async () => {
    const user = userEvent.setup();
    renderFrame();
    const views = screen.getByRole('button', { name: 'Views' });

    await user.click(views);

    expect(views).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Watch time' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByLabelText('isolated')).toHaveTextContent('0');

    await user.click(views);

    expect(views).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('isolated')).toHaveTextContent('none');
  });

  it('keeps the frame and puts the empty line in place of the chart', () => {
    renderFrame({ state: 'empty' });

    const figure = within(screen.getByRole('figure'));

    expect(figure.getByText('Views per day')).toBeInTheDocument();
    expect(figure.getByText('No data yet')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Chart drawing' })).not.toBeInTheDocument();
  });

  it('keeps the frame and offers a retry in place of the chart', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderFrame({ state: 'error', onRetry });

    expect(screen.getByText('Could not load this')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByRole('img', { name: 'Chart drawing' })).not.toBeInTheDocument();
  });

  it('draws the skeleton while loading', () => {
    const { container } = renderFrame({ state: 'loading', size: 'lg' });

    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="chart-skeleton"]')).toBeInTheDocument();
  });

  it.each(variantNames(chartFrameStyles.variants.size))(
    'reserves the same plot height for the %s frame and its skeleton',
    (size) => {
      const { container } = render(<ChartSkeleton size={size} />);
      renderFrame({ size });

      const skeletonPlot = container.querySelector('[data-slot="chart-skeleton"] > div:last-child');
      const framePlot = document.querySelector('[data-slot="chart-frame-plot"]');

      expect(heightOf(framePlot)).toMatch(/^tw:h-/);
      expect(heightOf(skeletonPlot)).toBe(heightOf(framePlot));
    }
  );

  it('passes axe, loaded, isolated and as a skeleton', async () => {
    const user = userEvent.setup();
    renderFrame();
    render(<ChartSkeleton />);

    await user.click(screen.getByRole('button', { name: 'Watch time' }));

    expect(await axeViolations()).toEqual([]);
  });
});
