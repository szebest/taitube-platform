import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Tabs } from '.';
import { TabsRoot } from './tabs';
import { tabsStyles } from './tabs.variants';

const meta = {
  title: 'Primitives/Tabs',
  component: TabsRoot,
  tags: ['motion'],
} satisfies Meta<typeof TabsRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const Channel = (props: { variant: 'ghost' | 'soft'; size: 'sm' | 'md'; vertical?: boolean }) => (
  <Tabs.Root
    defaultValue="videos"
    variant={props.variant}
    size={props.size}
    orientation={props.vertical ? 'vertical' : 'horizontal'}
  >
    <Tabs.List aria-label={`${props.variant} ${props.size}`}>
      <Tabs.Tab value="videos">Videos</Tabs.Tab>
      <Tabs.Tab value="shorts">Shorts</Tabs.Tab>
      <Tabs.Tab value="about" disabled>
        About
      </Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel value="videos">Every upload, newest first.</Tabs.Panel>
    <Tabs.Panel value="shorts">Vertical clips.</Tabs.Panel>
  </Tabs.Root>
);

export const FillsAndSizes: Story = {
  render: () => (
    <div className="tw:flex tw:flex-col tw:gap-stack">
      {variantNames(tabsStyles.variants.variant).flatMap((variant) =>
        variantNames(tabsStyles.variants.size).map((size) => (
          <Channel key={`${variant}-${size}`} variant={variant} size={size} />
        ))
      )}
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="tw:flex tw:gap-stack">
      <Channel variant="ghost" size="md" vertical />
      <Channel variant="soft" size="md" vertical />
    </div>
  ),
};

export const Slides: Story = {
  render: () => <Channel variant="ghost" size="md" />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const indicator = canvasElement.querySelector('[data-slot="tabs-indicator"]');
    await userEvent.click(canvas.getByRole('tab', { name: 'Shorts' }));

    const slid = (indicator?.getAnimations().length ?? 0) > 0;
    const reduced = document.documentElement.dataset.motion === 'reduced';
    if (slid === reduced) {
      throw new Error(
        reduced ? 'the underline moved under reduced motion' : 'the underline did not slide'
      );
    }
  },
};

export const SlidesReduced: Story = { ...Slides, globals: { motion: 'reduced' } };
