import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { AvatarFallback, AvatarRoot } from './avatar';
import { avatarStyles } from './avatar.variants';

const meta = {
  title: 'Primitives/Avatar',
  component: AvatarRoot,
} satisfies Meta<typeof AvatarRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const PEOPLE = [
  { name: 'Marta Reis', monogram: 'M' },
  { name: 'Ólafur Arnalds', monogram: 'Ó' },
  { name: '佐藤 健', monogram: '佐' },
];

export const SizesShapesAndTones: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-stack tw:text-caption tw:text-fg-muted">
      {variantNames(avatarStyles.variants.shape).map((shape) => (
        <div key={shape} className="tw:flex tw:items-center tw:gap-stack">
          <span className="tw:w-12">{shape}</span>
          {variantNames(avatarStyles.variants.size).map((size) => (
            <AvatarRoot key={size} {...args} size={size} shape={shape}>
              <AvatarFallback aria-label="Marta Reis">M</AvatarFallback>
            </AvatarRoot>
          ))}
          <AvatarRoot {...args} size="lg" shape={shape} tone="live">
            <AvatarFallback aria-label="Marta Reis, live">M</AvatarFallback>
          </AvatarRoot>
        </div>
      ))}
      <div className="tw:flex tw:items-center">
        {PEOPLE.map(({ name, monogram }) => (
          <AvatarRoot
            key={name}
            {...args}
            size="sm"
            className="tw:-me-1 tw:shadow-[0_0_0_2px_var(--bg)]"
          >
            <AvatarFallback aria-label={name}>{monogram}</AvatarFallback>
          </AvatarRoot>
        ))}
      </div>
    </div>
  ),
};
