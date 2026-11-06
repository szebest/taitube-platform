import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '@vp/ui';
import {
  CHART_SERIES,
  ChartFrame,
  ChartSkeleton,
  chartFrameStyles,
  useChartFrame,
  useChartTheme,
} from '..';
import { ChartFrameRoot, type ChartFrameRootProps } from '../chart-frame';

const meta = {
  title: 'Studio/ChartFrame',
  component: ChartFrameRoot,
} satisfies Meta<typeof ChartFrameRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const SERIES_NAMES = ['Views', 'Watch time', 'Subscribers', 'Shares', 'Likes', 'Comments'];

const THEMES = ['sand', 'nocturne'];
const MODES = ['dark', 'light'];

function SeriesSwatches() {
  const { isolated } = useChartFrame();
  const { categorical, grid } = useChartTheme();

  return (
    <div
      className="grid h-full grid-cols-6 items-end gap-inline border-b-divider"
      style={{ borderColor: grid }}
    >
      {categorical.map((colour, series) => (
        <div
          key={colour}
          className="rounded-t-xs transition-opacity duration-base"
          style={{
            background: colour,
            height: `${40 + series * 10}%`,
            opacity: isolated === undefined || isolated === series ? 1 : 0.25,
          }}
        />
      ))}
    </div>
  );
}

function Frame(props: ChartFrameRootProps) {
  return (
    <ChartFrame.Root {...props}>
      <ChartFrame.Title>Six series, one per categorical colour</ChartFrame.Title>
      <ChartFrame.Legend>
        {CHART_SERIES.map((series) => (
          <ChartFrame.LegendItem key={series} series={series}>
            {SERIES_NAMES[series]}
          </ChartFrame.LegendItem>
        ))}
      </ChartFrame.Legend>
      <ChartFrame.Plot>
        <SeriesSwatches />
      </ChartFrame.Plot>
      <ChartFrame.Description>
        Six bars, rising from 40 to 90 percent of the plot height.
      </ChartFrame.Description>
    </ChartFrame.Root>
  );
}

export const Ready: Story = {
  render: () => <Frame />,
};

export const EverySize: Story = {
  render: () => (
    <div className="flex flex-col gap-section">
      {variantNames(chartFrameStyles.variants.size).map((size) => (
        <Frame key={size} size={size} />
      ))}
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="flex flex-col gap-section">
      {variantNames(chartFrameStyles.variants.size).map((size) => (
        <ChartSkeleton key={size} size={size} />
      ))}
    </div>
  ),
};

export const Empty: Story = {
  render: () => <Frame state="empty" />,
};

export const ErrorState: Story = {
  name: 'Error',
  render: () => <Frame state="error" onRetry={() => undefined} />,
};

export const IsolatedSeries: Story = {
  render: () => <Frame />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Watch time' }));
  },
};

function Palette({ colours }: { colours: readonly string[] }) {
  return (
    <div className="flex gap-inline">
      {colours.map((colour) => (
        <div key={colour} className="size-control-lg rounded-xs" style={{ background: colour }} />
      ))}
    </div>
  );
}

function Palettes() {
  const { categorical, sequential, diverging } = useChartTheme();

  return (
    <div className="flex flex-col gap-inline">
      <Palette colours={categorical} />
      <Palette colours={sequential} />
      <Palette colours={diverging} />
    </div>
  );
}

export const EveryPalette: Story = {
  render: () => (
    <div className="grid gap-grid-x medium:grid-cols-2">
      {THEMES.flatMap((theme) =>
        MODES.map((mode) => (
          <section
            key={`${theme}-${mode}`}
            data-theme={theme}
            data-mode={mode}
            aria-label={`${theme}, ${mode}`}
            className="flex flex-col gap-stack rounded-card bg-surface p-inset-card text-fg"
          >
            <p className="m-0 text-label">
              {theme}, {mode}
            </p>
            <Palettes />
          </section>
        ))
      )}
    </div>
  ),
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: () => <Frame />,
};
