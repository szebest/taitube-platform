import { IconButton, Icon, Select } from '@kit/ui';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { CollaboratorList, CollaboratorListSkeleton } from '..';

const AVATAR = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#2f4a5c"/></svg>'
)}`;

const frame: Decorator = (Story) => (
  <div className="max-w-[36rem] p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/CollaboratorList',
  tags: ['text'],
  component: CollaboratorList.Root,
  args: { 'aria-label': 'Collaborators' },
  decorators: [frame],
} satisfies Meta<typeof CollaboratorList.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

const RoleSelect = ({ name, initial }: { name: string; initial: string }) => (
  <Select.Root defaultValue={initial}>
    <Select.Trigger size="sm" aria-label={`Role of ${name}`}>
      <Select.Value />
    </Select.Trigger>
    <Select.Content>
      <Select.Item value="editor">Editor</Select.Item>
      <Select.Item value="viewer">Viewer</Select.Item>
    </Select.Content>
  </Select.Root>
);

const Remove = ({ name }: { name: string }) => (
  <IconButton size="sm" aria-label={`Remove ${name}`}>
    <Icon name="close" />
  </IconButton>
);

export const OwnerAndCollaborators: Story = {
  render: (args) => (
    <CollaboratorList.Root {...args}>
      <CollaboratorList.Item>
        <CollaboratorList.Avatar src={AVATAR} name="Ana Costa" />
        <CollaboratorList.Name>Ana Costa</CollaboratorList.Name>
        <CollaboratorList.Meta>Owner</CollaboratorList.Meta>
      </CollaboratorList.Item>
      <CollaboratorList.Item>
        <CollaboratorList.Avatar src={undefined} name="Bruno Lima" />
        <CollaboratorList.Name>Bruno Lima</CollaboratorList.Name>
        <CollaboratorList.Meta>Joined 3 days ago</CollaboratorList.Meta>
        <CollaboratorList.Actions>
          <RoleSelect name="Bruno Lima" initial="editor" />
          <Remove name="Bruno Lima" />
        </CollaboratorList.Actions>
      </CollaboratorList.Item>
    </CollaboratorList.Root>
  ),
};

export const LongName: Story = {
  render: (args) => (
    <CollaboratorList.Root {...args}>
      <CollaboratorList.Item>
        <CollaboratorList.Avatar src={AVATAR} name="Maria" />
        <CollaboratorList.Name>
          The Extremely Patient Society for Night Trams, Wet Tiles and Other Quiet Things
        </CollaboratorList.Name>
        <CollaboratorList.Meta>Joined 3 days ago</CollaboratorList.Meta>
        <CollaboratorList.Actions>
          <RoleSelect name="Society" initial="viewer" />
          <Remove name="Society" />
        </CollaboratorList.Actions>
      </CollaboratorList.Item>
    </CollaboratorList.Root>
  ),
};

export const NoMeta: Story = {
  render: (args) => (
    <CollaboratorList.Root {...args}>
      <CollaboratorList.Item>
        <CollaboratorList.Avatar src={undefined} name="Carla Dias" />
        <CollaboratorList.Name>Carla Dias</CollaboratorList.Name>
        <CollaboratorList.Actions>
          <Remove name="Carla Dias" />
        </CollaboratorList.Actions>
      </CollaboratorList.Item>
    </CollaboratorList.Root>
  ),
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: (args) => (
    <CollaboratorList.Root {...args}>
      <CollaboratorList.Item>
        <CollaboratorList.Avatar src={undefined} name="منى" />
        <CollaboratorList.Name>منى الحسن</CollaboratorList.Name>
        <CollaboratorList.Meta>انضمت قبل ثلاثة أيام</CollaboratorList.Meta>
        <CollaboratorList.Actions>
          <RoleSelect name="منى" initial="editor" />
          <Remove name="منى" />
        </CollaboratorList.Actions>
      </CollaboratorList.Item>
    </CollaboratorList.Root>
  ),
};

export const Skeleton: Story = { render: () => <CollaboratorListSkeleton /> };
