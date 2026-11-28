import type { Meta, StoryObj } from '@storybook/react-vite';
import { ContentSection } from '..';
import type { ContentSectionLayout } from '../types';

const ITEMS = [
  'Pilot',
  'Second thoughts',
  'The long way round',
  'Season finale',
  'Bloopers',
  'Behind the scenes',
];

function StorySection({ layout }: { layout: ContentSectionLayout }) {
  return (
    <ContentSection.Root layout={layout} density="comfortable">
      <ContentSection.Header>
        <ContentSection.Title>Season one</ContentSection.Title>
        <ContentSection.Subtitle>Start with the pilot</ContentSection.Subtitle>
        <ContentSection.Action asChild>
          <a href="#all">See all</a>
        </ContentSection.Action>
      </ContentSection.Header>
      <ContentSection.Items>
        {ITEMS.map((item) => (
          <ContentSection.Item key={item}>
            <div className="rounded-card bg-surface p-inset-card">{item}</div>
          </ContentSection.Item>
        ))}
      </ContentSection.Items>
    </ContentSection.Root>
  );
}

const meta = {
  title: 'Components/ContentSection',
  component: StorySection,
} satisfies Meta<typeof StorySection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Shelf: Story = { args: { layout: { type: 'shelf' } } };
export const Grid: Story = { args: { layout: { type: 'grid', columns: 3 } } };
export const List: Story = { args: { layout: { type: 'list' } } };
export const Masonry: Story = { args: { layout: { type: 'masonry' } } };
