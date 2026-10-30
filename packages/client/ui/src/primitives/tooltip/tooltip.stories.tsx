import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon } from '../icon';
import { IconButton } from '../icon-button';
import { Kbd } from '../kbd';
import { Tooltip } from '.';
import { TooltipContent } from './tooltip';
import type { Side } from '../../types';

const meta = {
  title: 'Primitives/Tooltip',
  component: TooltipContent,
  tags: ['motion'],
} satisfies Meta<typeof TooltipContent>;

export default meta;

type Story = StoryObj<typeof meta>;

const SIDES: readonly Side[] = ['block-start', 'inline-end', 'block-end', 'inline-start'];

export const EverySide: Story = {
  render: (args) => (
    <Tooltip.Provider>
      <div className="tw:grid tw:w-fit tw:grid-cols-2 tw:gap-x-48 tw:gap-y-24 tw:p-section">
        {SIDES.map((side) => (
          <Tooltip.Root key={side} open>
            <Tooltip.Trigger asChild>
              <IconButton aria-label="Mute" variant="soft">
                <Icon name="volume" />
              </IconButton>
            </Tooltip.Trigger>
            <Tooltip.Content {...args} side={side}>
              Mute <Kbd size="sm">M</Kbd>
            </Tooltip.Content>
          </Tooltip.Root>
        ))}
      </div>
    </Tooltip.Provider>
  ),
};
