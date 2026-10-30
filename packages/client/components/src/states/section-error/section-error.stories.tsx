import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '@vp/ui';
import { SectionError, sectionErrorStyles } from '.';
import { SectionErrorRoot } from './section-error';

const meta = {
  title: 'Components/SectionError',
  component: SectionErrorRoot,
  args: { onRetry: () => undefined },
} satisfies Meta<typeof SectionErrorRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LayoutsAndTones: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-stack">
      {variantNames(sectionErrorStyles.variants.layout).map((layout) =>
        variantNames(sectionErrorStyles.variants.tone).map((tone) => (
          <SectionError.Root
            key={`${layout}-${tone}`}
            {...args}
            layout={layout}
            tone={tone}
            className="tw:min-h-40"
          >
            <SectionError.Message>Comments did not load.</SectionError.Message>
            <SectionError.Support>The rest of the page is fine.</SectionError.Support>
          </SectionError.Root>
        ))
      )}
    </div>
  ),
};

export const Retrying: Story = {
  render: (args) => (
    <SectionError.Root {...args} retrying>
      <SectionError.Message>Comments did not load.</SectionError.Message>
      <SectionError.Support>Trying again.</SectionError.Support>
    </SectionError.Root>
  ),
};
