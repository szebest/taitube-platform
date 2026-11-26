import { Badge, Button, Icon, IconButton, SortableList, useToast } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import {
  ACCENTS,
  IdentityEntryRow,
  identitiesQueryOptions,
  useApi,
  useFailureToast,
  useIdentityChoices,
  useIdentitySwitcher,
} from '@vp/queries';
import {
  useIdentityLook,
  usePromoteChannel,
} from '#app/features/account/hooks/use-identity-settings';
import { useT } from '#app/lib/messages';
import { SettingItem } from '../setting-item/setting-item';

/** The order of the switcher: every identity, dragged into place; the order is the pins. */
export function AccountOrderRow() {
  const { tOr } = useT();
  const { entries } = useIdentityChoices(true);
  const { setPinned } = useIdentityLook();
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));

  const pinned = (keys: readonly string[]) =>
    keys.flatMap((key) => {
      const entry = byKey.get(key);
      return entry ? [entry.identity] : [];
    });
  const togglePin = (key: string) =>
    void setPinned(
      pinned(
        entries
          .filter((entry) => (entry.key === key ? !entry.pinned : entry.pinned))
          .map((entry) => entry.key)
      )
    );

  return (
    <SettingItem
      row="account-order"
      stacked
      description={tOr('settings.rowDescription', { row: 'account-order' }, '')}
    >
      <SortableList.Root
        items={entries.map((entry) => entry.key)}
        onReorder={(next) => void setPinned(pinned(next))}
        aria-label={tOr('settings.rowLabel', { row: 'account-order' }, '')}
      >
        {entries.map((entry) => (
          <SortableList.Item key={entry.key} id={entry.key} aria-label={entry.name}>
            <SortableList.Handle />
            <IdentityEntryRow entry={entry} check={false} />
            <IconButton
              size="sm"
              variant={entry.pinned ? 'soft' : 'ghost'}
              aria-pressed={entry.pinned}
              aria-label={tOr(
                entry.pinned ? 'accountSettings.unpin' : 'accountSettings.pin',
                { name: entry.name },
                ''
              )}
              onClick={() => togglePin(entry.key)}
            >
              <Icon name="pin" />
            </IconButton>
          </SortableList.Item>
        ))}
      </SortableList.Root>
    </SettingItem>
  );
}

/** The ring colour of each identity, one of the theme's six. */
export function AccountAccentRow() {
  const { tOr } = useT();
  const { entries } = useIdentityChoices(true);
  const { setAccent } = useIdentityLook();

  return (
    <SettingItem
      row="account-accent"
      stacked
      description={tOr('settings.rowDescription', { row: 'account-accent' }, '')}
    >
      <ul className="m-0 flex list-none flex-col gap-stack p-0">
        {entries.map((entry) => (
          <li key={entry.key} className="flex flex-wrap items-center justify-between gap-inline">
            <span className="text-body-sm">{entry.name}</span>
            <fieldset className="m-0 flex gap-inline border-0 p-0">
              <legend className="sr-only">
                {tOr('accountSettings.accentFor', { name: entry.name }, '')}
              </legend>
              {ACCENTS.map((accent) => (
                <button
                  key={accent}
                  type="button"
                  aria-pressed={entry.accent === accent}
                  aria-label={tOr('accountSettings.accentOption', { accent: String(accent) }, '')}
                  className="cursor-pointer rounded-full border-0 bg-transparent p-1 focus-ring"
                  onClick={() => void setAccent(entry.identity, accent)}
                >
                  <span
                    className="block size-4 rounded-full outline-offset-2"
                    style={{
                      backgroundColor: `var(--dataviz-categorical-${accent})`,
                      outline:
                        entry.accent === accent
                          ? `2px solid var(--dataviz-categorical-${accent})`
                          : undefined,
                    }}
                  />
                </button>
              ))}
            </fieldset>
          </li>
        ))}
      </ul>
    </SettingItem>
  );
}

/** The channels the account owns: which one it opens as, and a way to create another. */
export function OwnedChannelsRow() {
  const { tOr } = useT();
  const toast = useToast();
  const showFailure = useFailureToast();
  const { show } = useIdentitySwitcher();
  const promote = usePromoteChannel();
  const owned = useQuery(identitiesQueryOptions(useApi())).data?.owned ?? [];

  const makePrimary = (id: string, name: string) =>
    promote.mutate(id, {
      onSuccess: () =>
        toast({ tone: 'success', title: tOr('accountSettings.promoted', { name }, '') }),
      onError: (error) => showFailure(tOr('accounts.promoteFailed', {}, ''), error),
    });

  return (
    <SettingItem
      row="owned-channels"
      stacked
      description={tOr('settings.rowDescription', { row: 'owned-channels' }, '')}
    >
      <ul className="m-0 flex list-none flex-col gap-stack p-0">
        {owned.map((channel) => (
          <li key={channel.id} className="flex items-center justify-between gap-inline">
            <span className="min-w-0 truncate text-body-sm">
              {channel.displayName} <span className="text-fg-muted">@{channel.handle}</span>
            </span>
            {channel.isPrimary ? (
              <Badge variant="soft" tone="accent" size="sm">
                {tOr('accounts.primary', {}, '')}
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                loading={promote.isPending && promote.variables === channel.id}
                onClick={() => makePrimary(channel.id, channel.displayName)}
              >
                {tOr('accounts.makePrimary', {}, '')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Button variant="soft" className="self-start" onClick={() => show('create-channel')}>
        {tOr('accounts.createChannel', {}, '')}
      </Button>
    </SettingItem>
  );
}
