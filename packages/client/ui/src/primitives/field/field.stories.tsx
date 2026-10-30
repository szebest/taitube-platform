import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from '../checkbox';
import { Input } from '../input';
import { Select } from '../select';
import { Switch } from '../switch';
import { Textarea } from '../textarea';
import { Field } from '.';
import { FieldRoot } from './field';

const meta = {
  title: 'Primitives/Field',
  component: FieldRoot,
} satisfies Meta<typeof FieldRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const VerticalWithEveryControl: Story = {
  render: (args) => (
    <div className="tw:flex tw:max-w-[28rem] tw:flex-col tw:gap-stack">
      <Field.Root {...args} required>
        <Field.Label>Title</Field.Label>
        <Input placeholder="Add a title" />
        <Field.Hint>Up to 100 characters.</Field.Hint>
      </Field.Root>
      <Field.Root {...args} invalid>
        <Field.Label>Description</Field.Label>
        <Textarea />
        <Field.Error>Write a description of at least 20 characters</Field.Error>
      </Field.Root>
      <Field.Root {...args}>
        <Field.Label>Visibility</Field.Label>
        <Select.Root defaultValue="public">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="public">Public</Select.Item>
            <Select.Item value="private">Private</Select.Item>
          </Select.Content>
        </Select.Root>
        <Field.Hint>Who can watch it.</Field.Hint>
      </Field.Root>
    </div>
  ),
};

export const HorizontalRows: Story = {
  render: (args) => (
    <div className="tw:flex tw:max-w-[28rem] tw:flex-col tw:gap-stack">
      <Field.Root {...args} orientation="horizontal">
        <Checkbox defaultChecked />
        <Field.Label>Notify me about replies</Field.Label>
        <Field.Hint>Sent to your email once a day.</Field.Hint>
      </Field.Root>
      <Field.Root {...args} orientation="horizontal">
        <Switch />
        <Field.Label>Autoplay</Field.Label>
      </Field.Root>
      <Field.Root {...args} orientation="horizontal" invalid>
        <Checkbox />
        <Field.Label>I accept the terms</Field.Label>
        <Field.Error>Accept the terms to continue</Field.Error>
      </Field.Root>
    </div>
  ),
};
