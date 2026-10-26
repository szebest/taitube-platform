import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Button } from '../button';
import { Card } from '.';
import { CardRoot } from './card';
import { cardStyles } from './card.variants';

const meta = {
  title: 'Primitives/Card',
  component: CardRoot,
} satisfies Meta<typeof CardRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const LOOKS = [
  { name: 'solid', variant: 'solid' },
  { name: 'outline', variant: 'outline' },
  { name: 'ghost', variant: 'ghost' },
  { name: 'raised', variant: 'solid', elevation: 2 },
] as const;

export const FillsAndSizes: Story = {
  render: (args) => (
    <div className="tw:grid tw:max-w-3xl tw:grid-cols-2 tw:gap-grid-x">
      {variantNames(cardStyles.variants.size).flatMap((size) =>
        LOOKS.map(({ name, ...look }) => (
          <Card.Root key={`${size}-${name}`} {...args} {...look} size={size}>
            <Card.Header>
              <Card.Title>Upload quality</Card.Title>
              <Card.Description>
                {name}, {size}: applies to new uploads
              </Card.Description>
            </Card.Header>
            <Card.Footer>
              <Button size="sm" variant="solid" tone="accent">
                Save
              </Button>
            </Card.Footer>
          </Card.Root>
        ))
      )}
    </div>
  ),
};

export const WithActionAndAsLink: Story = {
  render: (args) => (
    <div className="tw:grid tw:max-w-3xl tw:grid-cols-2 tw:gap-grid-x tw:rounded-card tw:bg-surface tw:p-inset-card">
      <Card.Root {...args} variant="outline">
        <Card.Header>
          <Card.Title>A long title that wraps onto a second line inside the card</Card.Title>
          <Card.Description>Last 28 days</Card.Description>
          <Card.Action>
            <Button size="sm" variant="ghost">
              Export
            </Button>
          </Card.Action>
        </Card.Header>
        <Card.Body className="tw:text-display">1,204</Card.Body>
      </Card.Root>
      <Card.Root {...args} asChild>
        <a href="#watch">
          <Card.Header>
            <Card.Title>Lisbon at night</Card.Title>
            <Card.Description>The whole card is the link</Card.Description>
          </Card.Header>
        </a>
      </Card.Root>
    </div>
  ),
};
