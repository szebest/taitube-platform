import { FALLBACK_ACTIVE_LOCALE, IntlProvider } from '@kit/intl-react';
import { Badge, Button } from '@kit/ui';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExperimentResultCard, type ExperimentResultCardExperiment } from '../index';

const result = (variantId: 'a' | 'b' | 'c', impressions: number, enough: boolean) => ({
  variantId,
  impressions,
  starts: Math.round(impressions * 0.08),
  watchSeconds: impressions * 12,
  watchSecondsPerImpression: enough ? 12 + impressions / 1000 : null,
  clickThrough: enough ? 0.08 : null,
  averageViewSeconds: enough ? 150 : null,
});

const running: ExperimentResultCardExperiment = {
  status: 'running',
  winnerVariantId: null,
  variants: [
    { id: 'a', title: 'Launch day', thumbnail: null },
    { id: 'b', title: 'We launched', thumbnail: null },
    { id: 'c', title: 'Launch day, the whole story', thumbnail: null },
  ],
  results: {
    enoughData: false,
    variants: [result('a', 640, false), result('b', 412, false), result('c', 1180, false)],
  },
};

const counted: ExperimentResultCardExperiment = {
  ...running,
  results: {
    enoughData: true,
    variants: [result('a', 1400, true), result('b', 2300, true), result('c', 1180, true)],
  },
};

const meta = {
  title: 'Studio/ExperimentResultCard',
  component: ExperimentResultCard.Root,
  args: { experiment: running },
  render: (args) => (
    <IntlProvider
      locale={FALLBACK_ACTIVE_LOCALE.locale}
      catalogues={FALLBACK_ACTIVE_LOCALE.catalogues}
      timeZone="UTC"
    >
      <ExperimentResultCard.Root {...args}>
        <ExperimentResultCard.Header>
          <h3 className="m-0">Title test</h3>
          <Badge size="sm">{args.experiment.status}</Badge>
        </ExperimentResultCard.Header>
        <ExperimentResultCard.Summary />
        <ExperimentResultCard.Variants
          action={(variant) =>
            args.experiment.status === 'running' ? (
              <Button variant="outline" size="sm">
                Apply {variant.id.toUpperCase()}
              </Button>
            ) : null
          }
        />
        {args.experiment.status === 'running' && (
          <ExperimentResultCard.Footer>
            <Button variant="outline">Stop the test</Button>
          </ExperimentResultCard.Footer>
        )}
      </ExperimentResultCard.Root>
    </IntlProvider>
  ),
} satisfies Meta<typeof ExperimentResultCard.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NotEnoughData: Story = {};

export const Counted: Story = { args: { experiment: counted } };

export const Finished: Story = {
  args: { experiment: { ...counted, status: 'finished', winnerVariantId: 'b' } },
};

export const Stopped: Story = {
  args: { experiment: { ...running, status: 'stopped' } },
};

export const Loading: Story = { render: () => <ExperimentResultCard.Skeleton /> };
