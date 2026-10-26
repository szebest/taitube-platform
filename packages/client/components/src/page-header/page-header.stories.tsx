import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, variantNames } from '@vp/ui';
import { PageHeader, PageHeaderSkeleton, pageHeaderStyles } from '.';
import { PageHeaderRoot } from './page-header';

const meta = {
  title: 'Components/PageHeader',
  component: PageHeaderRoot,
} satisfies Meta<typeof PageHeaderRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EveryTitleStyle: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-section">
      {variantNames(pageHeaderStyles.variants.titleStyle).map((titleStyle) => (
        <PageHeader.Root key={titleStyle} {...args} titleStyle={titleStyle}>
          {titleStyle === 'headline' && (
            <PageHeader.Back>
              <a href="/library">Library</a>
            </PageHeader.Back>
          )}
          <PageHeader.Title asChild>
            <h1>Your evening, in order</h1>
          </PageHeader.Title>
          <PageHeader.Description>142 videos, 3 still processing</PageHeader.Description>
          <PageHeader.Actions>
            <Button variant="outline">Filter</Button>
            <Button>Upload</Button>
          </PageHeader.Actions>
          <PageHeader.Tabs>
            <a href="/library">All</a>
          </PageHeader.Tabs>
        </PageHeader.Root>
      ))}
    </div>
  ),
};

export const TitleOnly: Story = {
  render: (args) => (
    <PageHeader.Root {...args}>
      <PageHeader.Title asChild>
        <h1>Settings</h1>
      </PageHeader.Title>
    </PageHeader.Root>
  ),
};

export const Skeleton: Story = {
  render: () => (
    <div className="tw:flex tw:flex-col tw:gap-section">
      {variantNames(pageHeaderStyles.variants.titleStyle).map((titleStyle) => (
        <PageHeaderSkeleton key={titleStyle} titleStyle={titleStyle} />
      ))}
    </div>
  ),
};
