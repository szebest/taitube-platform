import type { Meta, StoryObj } from '@storybook/react-vite';
import { PartyPermissionsProvider } from '@vp/permissions-react';
import { withPartyIntl } from '#app/__tests__/with-party-intl';
import { RoleEditor, type RoleEditorRole } from '..';

const UPDATED_AT = '2026-11-28T10:00:00.000Z';

const CUSTOM: RoleEditorRole = {
  id: 'r-custom',
  key: null,
  name: 'Queue keeper',
  colour: '#3366ff',
  position: 20,
  permissions: ['queue.add', 'chat.post'],
  memberCount: 2,
  updatedAt: UPDATED_AT,
};

const COHOST: RoleEditorRole = {
  id: 'r-cohost',
  key: 'cohost',
  name: 'Co-host',
  colour: '#e07a1f',
  position: 800,
  permissions: ['playback.control', 'queue.add'],
  memberCount: 1,
  updatedAt: UPDATED_AT,
};

const GUEST: RoleEditorRole = {
  id: 'r-guest',
  key: 'guest',
  name: 'Guest',
  colour: null,
  position: 0,
  permissions: ['voice.join'],
  memberCount: 3,
  updatedAt: UPDATED_AT,
};

interface EditorStoryArgs {
  roles: RoleEditorRole[];
  voice?: boolean;
}

const meta = {
  title: 'Web/RoleEditor',
  decorators: [withPartyIntl],
  args: { roles: [CUSTOM] },
  render: ({ roles, voice }) => (
    <PartyPermissionsProvider
      userContext={null}
      viewer={{
        permissions: ['roles.manage', 'queue.add', 'chat.post', 'playback.control'],
        topPosition: 600,
        isOwner: false,
        kind: 'user',
      }}
    >
      <RoleEditor.Root voice={voice} onUpdate={() => undefined} onDelete={() => undefined}>
        <RoleEditor.List>
          {roles.map((role) => (
            <RoleEditor.Role key={role.id} role={role} />
          ))}
        </RoleEditor.List>
        <RoleEditor.New onCreate={() => undefined} />
        <RoleEditor.Preset onApply={() => undefined} />
      </RoleEditor.Root>
    </PartyPermissionsProvider>
  ),
} satisfies Meta<EditorStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const DisabledRows: Story = { args: { roles: [CUSTOM, COHOST] } };
export const GuestCeiling: Story = { args: { roles: [GUEST], voice: true } };
