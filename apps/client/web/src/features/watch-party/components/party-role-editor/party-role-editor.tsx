import { Button, Dialog, Icon } from '@kit/ui';
import { PartyCan } from '@vp/permissions-react';
import { useFailureToast, type WatchPartySocket } from '@vp/queries';
import { RoleEditor } from '#app/components/party/role-editor';
import {
  type PartyRoleEdit,
  usePartyRoleEdits,
} from '#app/features/watch-party/hooks/use-party-role-edits';
import { useT } from '#app/lib/messages';

interface PartyRoleEditorProps {
  roomId: string;
  socket: WatchPartySocket;
  /** Voice is on in the room, so its permissions are offered. */
  voice?: boolean;
}

/** "Roles" in the room header, for `roles.manage`: the editor over the room's live roles. */
export function PartyRoleEditor({ roomId, socket, voice = false }: PartyRoleEditorProps) {
  const { tOr } = useT();
  const edits = usePartyRoleEdits(roomId);
  const showFailure = useFailureToast();
  const { roles } = socket.state;

  const apply = (edit: PartyRoleEdit) =>
    edits.mutate(edit, {
      onError: (error) => showFailure(tOr('party.roleEditorFailed', {}, ''), error),
    });

  return (
    <PartyCan gate={{ kind: 'permission', permission: 'roles.manage' }}>
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <Button size="sm" variant="ghost">
            <Icon name="shield" size="sm" />
            {tOr('party.roleEditorTitle', {}, '')}
          </Button>
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>{tOr('party.roleEditorTitle', {}, '')}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <RoleEditor.Root
              voice={voice}
              onUpdate={(roleId, patch) => {
                const role = roles.find((entry) => entry.id === roleId);
                if (role) {
                  apply({ type: 'update', roleId, updatedAt: role.updatedAt, ...patch });
                }
              }}
              onDelete={(roleId) => apply({ type: 'delete', roleId })}
            >
              <RoleEditor.List>
                {roles.map((role) => (
                  <RoleEditor.Role key={role.id} role={role} />
                ))}
              </RoleEditor.List>
              <RoleEditor.New onCreate={(name) => apply({ type: 'create', name })} />
              <RoleEditor.Preset onApply={(preset) => apply({ type: 'preset', preset })} />
            </RoleEditor.Root>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Root>
    </PartyCan>
  );
}
