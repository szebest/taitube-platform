import { Field, Select } from '@kit/ui';
import { PLAYLIST_COLLABORATOR_ROLES, type PlaylistCollaboratorRole } from '@vp/domain';
import { useT } from '#app/lib/messages';

export interface RoleSelectProps {
  value: PlaylistCollaboratorRole;
  onChange: (role: PlaylistCollaboratorRole) => void;
}

/** The role an invite seats someone with, labelled for its form. */
export function RoleSelect({ value, onChange }: RoleSelectProps) {
  const { tOr } = useT();

  return (
    <Field.Root className="basis-40">
      <Field.Label>{tOr('playlistPeople.roleLabel', {}, '')}</Field.Label>
      <Select.Root
        value={value}
        onValueChange={(next) => {
          const role = PLAYLIST_COLLABORATOR_ROLES.find((option) => option === next);
          if (role) onChange(role);
        }}
      >
        <Select.Trigger aria-label={tOr('playlistPeople.roleLabel', {}, '')}>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {PLAYLIST_COLLABORATOR_ROLES.map((role) => (
            <Select.Item key={role} value={role}>
              {tOr('playlistPeople.role', { role }, '')}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Field.Root>
  );
}
