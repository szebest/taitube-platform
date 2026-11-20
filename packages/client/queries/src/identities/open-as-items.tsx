import { DropdownMenu } from '@kit/ui';
import type { IdentityEntry } from './identity-entries';
import { IdentityEntryRow } from './identity-entry-row';

export interface OpenAsItemsProps {
  entries: readonly IdentityEntry[];
  onOpenAs: (entry: IdentityEntry) => void;
}

/** The identities a link can open as, loaded the first time the menu opens; an expired one is left out. */
export function OpenAsItems({ entries, onOpenAs }: OpenAsItemsProps) {
  return entries.map((entry) =>
    entry.expired ? null : (
      <DropdownMenu.Item key={entry.key} onSelect={() => onOpenAs(entry)}>
        <IdentityEntryRow entry={entry} check={false} />
      </DropdownMenu.Item>
    )
  );
}
