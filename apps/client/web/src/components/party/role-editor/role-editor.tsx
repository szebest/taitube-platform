import { AlertDialog, Button, Checkbox, Icon, IconButton, Input } from '@kit/ui';
import { WATCH_PARTY_PRESETS, type WatchPartyPermission } from '@vp/domain';
import { usePartyCan } from '@vp/permissions-react';
import { type ComponentPropsWithRef, type ReactNode, useId, useState } from 'react';
import { useT } from '#app/lib/messages';
import { getOfferedPermissions, PERMISSION_GROUPS } from './constants';
import { RoleEditorContext, useRoleEditor } from './role-editor.context';
import type { RoleEditorPatch, RoleEditorRole } from './types';

export interface RoleEditorRootProps extends ComponentPropsWithRef<'section'> {
  /** Voice is on in the room, so its permissions are offered. */
  voice?: boolean;
  onUpdate: (roleId: string, patch: RoleEditorPatch) => void;
  onDelete: (roleId: string) => void;
}

/** The room's roles, edited by the viewer's room ability: what they may not touch stays, disabled, with its reason. */
export function RoleEditorRoot({
  voice = false,
  onUpdate,
  onDelete,
  className,
  ...props
}: RoleEditorRootProps) {
  const { tOr } = useT();

  return (
    <RoleEditorContext value={{ voice, onUpdate, onDelete }}>
      <section
        data-slot="role-editor"
        aria-label={tOr('party.roleEditorTitle', {}, '')}
        className={`flex flex-col gap-section ${className ?? ''}`}
        {...props}
      />
    </RoleEditorContext>
  );
}

export function RoleEditorList({ className, ...props }: ComponentPropsWithRef<'ul'>) {
  return (
    <ul className={`m-0 flex list-none flex-col gap-stack p-0 ${className ?? ''}`} {...props} />
  );
}

function PermissionBox({
  role,
  permission,
  editable,
}: {
  role: RoleEditorRole;
  permission: WatchPartyPermission;
  editable: boolean;
}) {
  const { onUpdate } = useRoleEditor('Role');
  const { tOr } = useT();
  const grantable = usePartyCan({ kind: 'grant', permission });
  const held = role.permissions.includes(permission);

  const toggle = (checked: boolean) =>
    onUpdate(role.id, {
      permissions: checked
        ? [...role.permissions, permission]
        : role.permissions.filter((id) => id !== permission),
    });

  return (
    <label className="flex items-center gap-inline text-body-sm">
      <Checkbox
        checked={held}
        disabled={!(editable && grantable)}
        onCheckedChange={(checked) => toggle(checked === true)}
      />
      {tOr('party.rolePermission', { permission }, '')}
      {editable && !grantable && (
        <span className="text-caption text-fg-muted">
          {tOr('party.roleEditorGrantLimit', {}, '')}
        </span>
      )}
    </label>
  );
}

export interface RoleEditorRoleProps {
  role: RoleEditorRole;
}

export function RoleEditorRolePart({ role }: RoleEditorRoleProps) {
  const { voice, onUpdate, onDelete } = useRoleEditor('Role');
  const { tOr } = useT();
  const hintId = useId();
  const subject = { key: role.key, position: role.position };
  const editable = usePartyCan({ kind: 'role', action: 'update', role: subject });
  const deletable = usePartyCan({ kind: 'role', action: 'delete', role: subject });
  const offered = getOfferedPermissions(role.key, voice);

  const rename = (name: string) => {
    const next = name.trim();
    if (next && next !== role.name) {
      onUpdate(role.id, { name: next });
    }
  };

  return (
    <li data-slot="role-editor-role">
      <fieldset
        disabled={!editable}
        aria-label={role.name}
        aria-describedby={editable ? undefined : hintId}
        className="m-0 flex flex-col gap-inline rounded-control border border-line p-inset-card"
      >
        <div className="flex items-center gap-inline">
          <input
            type="color"
            key={`${role.id}-${role.colour}`}
            defaultValue={role.colour ?? '#808080'}
            aria-label={tOr('party.roleEditorColour', { name: role.name }, '')}
            onBlur={(event) => {
              if (event.target.value !== role.colour) {
                onUpdate(role.id, { colour: event.target.value });
              }
            }}
          />
          <Input
            key={`${role.id}-${role.name}`}
            defaultValue={role.name}
            aria-label={tOr('party.roleEditorName', { name: role.name }, '')}
            onBlur={(event) => rename(event.target.value)}
          />
          <span className="whitespace-nowrap text-caption text-fg-muted">
            {tOr('party.roleEditorMembers', { count: role.memberCount }, '')}
          </span>
          {role.key === null && deletable && (
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={tOr('party.roleEditorDelete', { name: role.name }, '')}
              onClick={() => onDelete(role.id)}
            >
              <Icon name="trash" />
            </IconButton>
          )}
        </div>
        {!editable && (
          <p id={hintId} className="m-0 text-caption text-fg-muted">
            {tOr('party.roleEditorReadOnly', {}, '')}
          </p>
        )}
        {PERMISSION_GROUPS.filter((group) => offered[group].length > 0).map((group) => (
          <div key={group} role="group" aria-label={tOr('party.roleGroup', { group }, '')}>
            <h4 className="m-0 text-label text-fg-muted">
              {tOr('party.roleGroup', { group }, '')}
            </h4>
            <div className="flex flex-col gap-inline">
              {offered[group].map((permission) => (
                <PermissionBox
                  key={permission}
                  role={role}
                  permission={permission}
                  editable={editable}
                />
              ))}
            </div>
          </div>
        ))}
      </fieldset>
    </li>
  );
}

/** Only where the viewer may create roles. */
export function RoleEditorNew({ onCreate }: { onCreate: (name: string) => void }) {
  const { tOr } = useT();
  const [name, setName] = useState('');
  const allowed = usePartyCan({ kind: 'permission', permission: 'roles.manage' });

  if (!allowed) {
    return null;
  }

  return (
    <form
      data-slot="role-editor-new"
      className="flex items-center gap-inline"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate(name.trim());
        setName('');
      }}
    >
      <Input
        value={name}
        maxLength={32}
        placeholder={tOr('party.roleEditorNewName', {}, '')}
        aria-label={tOr('party.roleEditorNewName', {}, '')}
        onChange={(event) => setName(event.target.value)}
      />
      <Button type="submit" size="sm" variant="soft" disabled={name.trim() === ''}>
        {tOr('party.roleEditorCreate', {}, '')}
      </Button>
    </form>
  );
}

export interface RoleEditorPresetProps {
  onApply: (preset: (typeof WATCH_PARTY_PRESETS)[number]) => void;
  children?: ReactNode;
}

/** One confirm per preset: applying it resets every built-in role but Owner. */
export function RoleEditorPreset({ onApply }: RoleEditorPresetProps) {
  const { tOr } = useT();
  const allowed = usePartyCan({ kind: 'permission', permission: 'roles.manage' });

  if (!allowed) {
    return null;
  }

  return (
    <div data-slot="role-editor-preset" className="flex flex-wrap items-center gap-inline">
      {WATCH_PARTY_PRESETS.map((preset) => (
        <AlertDialog.Root key={preset}>
          <AlertDialog.Trigger asChild>
            <Button size="sm" variant="ghost">
              {tOr('party.roleEditorPreset', {}, '')}:{' '}
              {tOr('party.roleEditorPresetName', { preset }, '')}
            </Button>
          </AlertDialog.Trigger>
          <AlertDialog.Content>
            <AlertDialog.Title>{tOr('party.roleEditorPresetTitle', {}, '')}</AlertDialog.Title>
            <AlertDialog.Description>
              {tOr('party.roleEditorPresetDescription', {}, '')}
            </AlertDialog.Description>
            <AlertDialog.Footer>
              <AlertDialog.Cancel asChild>
                <Button variant="ghost">{tOr('party.roleEditorCancel', {}, '')}</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button onClick={() => onApply(preset)}>
                  {tOr('party.roleEditorConfirm', {}, '')}
                </Button>
              </AlertDialog.Action>
            </AlertDialog.Footer>
          </AlertDialog.Content>
        </AlertDialog.Root>
      ))}
    </div>
  );
}
