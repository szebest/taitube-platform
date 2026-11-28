import { Select, Slider, Switch, TagInput } from '@kit/ui';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SmartRuleBuilder } from '..';

const frame: Decorator = (Story) => (
  <div className="max-w-[44rem] p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/SmartRuleBuilder',
  tags: ['text'],
  component: SmartRuleBuilder.Root,
  args: { 'aria-label': 'Smart playlist rules' },
  decorators: [frame],
} satisfies Meta<typeof SmartRuleBuilder.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

const noop = () => undefined;

const FieldSelect = ({ value, label }: { value: string; label: string }) => (
  <Select.Root defaultValue={value}>
    <Select.Trigger size="sm" aria-label={label}>
      <Select.Value />
    </Select.Trigger>
    <Select.Content>
      <Select.Item value="channel">Channel</Select.Item>
      <Select.Item value="duration">Duration</Select.Item>
      <Select.Item value="watched">Watched</Select.Item>
    </Select.Content>
  </Select.Root>
);

const ChannelCondition = ({ number }: { number: number }) => {
  const [channels, setChannels] = useState(['Marta Reis Films']);

  return (
    <SmartRuleBuilder.Condition onRemove={noop} removeLabel={`Remove condition ${number}`}>
      <FieldSelect value="channel" label={`Field of condition ${number}`} />
      <TagInput
        value={channels}
        onValueChange={setChannels}
        aria-label={`Channels of condition ${number}`}
        className="min-w-[12rem] flex-1"
      />
    </SmartRuleBuilder.Condition>
  );
};

const DurationCondition = ({ number }: { number: number }) => {
  const [minutes, setMinutes] = useState([10]);

  return (
    <SmartRuleBuilder.Condition onRemove={noop} removeLabel={`Remove condition ${number}`}>
      <FieldSelect value="duration" label={`Field of condition ${number}`} />
      <span className="text-label">under {minutes[0]} minutes</span>
      <Slider.Root
        value={minutes}
        onValueChange={setMinutes}
        min={1}
        max={60}
        className="min-w-[10rem] flex-1"
      >
        <Slider.Thumb aria-label={`Minutes of condition ${number}`} />
      </Slider.Root>
    </SmartRuleBuilder.Condition>
  );
};

const WatchedCondition = ({ number }: { number: number }) => {
  const [unwatched, setUnwatched] = useState(true);

  return (
    <SmartRuleBuilder.Condition onRemove={noop} removeLabel={`Remove condition ${number}`}>
      <FieldSelect value="watched" label={`Field of condition ${number}`} />
      <Switch
        checked={unwatched}
        onCheckedChange={setUnwatched}
        aria-label={`Unwatched only in condition ${number}`}
      />
      <span className="text-label">unwatched</span>
    </SmartRuleBuilder.Condition>
  );
};

const MatchControl = () => (
  <>
    <span className="text-label">Videos that match</span>
    <Select.Root defaultValue="all">
      <Select.Trigger size="sm" aria-label="Match mode">
        <Select.Value />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="all">all of these</Select.Item>
        <Select.Item value="any">any of these</Select.Item>
      </Select.Content>
    </Select.Root>
  </>
);

const Footer = () => (
  <SmartRuleBuilder.Footer>
    <Select.Root defaultValue="newest">
      <Select.Trigger size="sm" aria-label="Sort by">
        <Select.Value />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="newest">Newest first</Select.Item>
        <Select.Item value="longest">Longest first</Select.Item>
      </Select.Content>
    </Select.Root>
    <span className="text-label">Up to 50 videos</span>
  </SmartRuleBuilder.Footer>
);

export const ThreeConditions: Story = {
  render: (args) => (
    <SmartRuleBuilder.Root {...args}>
      <SmartRuleBuilder.Match>
        <MatchControl />
      </SmartRuleBuilder.Match>
      <SmartRuleBuilder.Conditions>
        <ChannelCondition number={1} />
        <DurationCondition number={2} />
        <WatchedCondition number={3} />
      </SmartRuleBuilder.Conditions>
      <SmartRuleBuilder.Add onClick={noop}>Add condition</SmartRuleBuilder.Add>
      <Footer />
    </SmartRuleBuilder.Root>
  ),
};

export const NoConditions: Story = {
  render: (args) => (
    <SmartRuleBuilder.Root {...args}>
      <SmartRuleBuilder.Match>
        <MatchControl />
      </SmartRuleBuilder.Match>
      <SmartRuleBuilder.Add onClick={noop}>Add condition</SmartRuleBuilder.Add>
      <Footer />
    </SmartRuleBuilder.Root>
  ),
};

export const AtTheLimit: Story = {
  render: (args) => (
    <SmartRuleBuilder.Root {...args}>
      <SmartRuleBuilder.Match>
        <MatchControl />
      </SmartRuleBuilder.Match>
      <SmartRuleBuilder.Conditions>
        <ChannelCondition number={1} />
        <DurationCondition number={2} />
        <WatchedCondition number={3} />
      </SmartRuleBuilder.Conditions>
      <SmartRuleBuilder.Add onClick={noop} disabled>
        Add condition
      </SmartRuleBuilder.Add>
    </SmartRuleBuilder.Root>
  ),
};

export const Narrow: Story = {
  globals: { viewport: { value: 'mobile1' } },
  render: ThreeConditions.render,
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: ThreeConditions.render,
};
