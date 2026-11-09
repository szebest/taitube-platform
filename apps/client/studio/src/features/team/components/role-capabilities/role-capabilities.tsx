import { CHANNEL_CAPABILITIES, type ChannelRole, roleHas } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { Callout } from '@vp/ui';

export interface RoleCapabilitiesProps {
  role: ChannelRole;
}

/** What one role can do, read off the same table the permission rules use. */
export function RoleCapabilities({ role }: RoleCapabilitiesProps) {
  const { tOr } = useT();

  return (
    <Callout.Root tone="info" role="status">
      <Callout.Icon />
      <Callout.Title>{tOr('studio.teamRoleCanTitle', { role }, '')}</Callout.Title>
      <Callout.Body>
        <ul className="m-0 flex list-disc flex-col gap-1 ps-5">
          {CHANNEL_CAPABILITIES.filter((capability) => roleHas(role, capability)).map(
            (capability) => (
              <li key={capability}>{tOr('studio.teamCapability', { capability }, '')}</li>
            )
          )}
        </ul>
      </Callout.Body>
    </Callout.Root>
  );
}
