import type { ApiScope } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { ScopePicker } from '#app/components/developers/scope-picker';

/** Every scope once, under what it touches, in the order a creator reads them. */
const SCOPE_GROUPS = [
  { group: 'videos', scopes: ['videos:read', 'videos:write'] },
  { group: 'analytics', scopes: ['analytics:read'] },
  { group: 'comments', scopes: ['comments:read', 'comments:moderate'] },
  { group: 'exports', scopes: ['exports:read', 'exports:create'] },
  { group: 'webhooks', scopes: ['webhooks:manage'] },
] as const satisfies readonly { group: string; scopes: readonly ApiScope[] }[];

export interface TokenScopePickerProps {
  value: readonly ApiScope[];
  onValueChange: (value: ApiScope[]) => void;
}

/** Every scope a token can carry, grouped by what it touches and described in the creator's words. */
export function TokenScopePicker({ value, onValueChange }: TokenScopePickerProps) {
  const { tOr } = useT();

  return (
    <ScopePicker.Root value={value} onValueChange={onValueChange}>
      <ScopePicker.Legend>{tOr('studio.tokenScopes', {}, '')}</ScopePicker.Legend>
      <div className="grid gap-stack medium:grid-cols-2">
        {SCOPE_GROUPS.map(({ group, scopes }) => (
          <ScopePicker.Group key={group}>
            <ScopePicker.GroupTitle>
              {tOr('studio.tokenScopeGroup', { group }, group)}
            </ScopePicker.GroupTitle>
            {scopes.map((scope) => (
              <ScopePicker.Item key={scope} scope={scope}>
                {tOr('studio.tokenScope', { scope }, scope)}
              </ScopePicker.Item>
            ))}
          </ScopePicker.Group>
        ))}
      </div>
    </ScopePicker.Root>
  );
}
