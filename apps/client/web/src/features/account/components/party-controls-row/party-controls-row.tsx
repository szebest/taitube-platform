import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PersonalControlView } from '@vp/api-contracts';
import { NO_PERSONAL_CONTROL } from '@vp/domain';
import {
  useApi,
  useFailureToast,
  watchPartyControlsKey,
  watchPartyControlsQueryOptions,
} from '@vp/queries';
import { PartyControlsList } from '#app/components/party/party-controls-list';
import { useT } from '#app/lib/messages';
import { SettingItem } from '../setting-item/setting-item';

/** Everything the viewer hid, muted or blocked in every watch party, each with its remove. */
export function PartyControlsRow() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { tOr } = useT();
  const showFailure = useFailureToast();
  const { data, isError } = useQuery(watchPartyControlsQueryOptions(api));
  const remove = useMutation({
    mutationFn: ({ targetKey }: PersonalControlView) =>
      api.watchPartyControls.putWatchPartyControl({
        body: { targetKey, roomId: null, ...NO_PERSONAL_CONTROL },
      }),
    onError: (error) => showFailure(tOr('party.controlsRemoveFailed', {}, ''), error),
    onSettled: () => queryClient.invalidateQueries({ queryKey: watchPartyControlsKey }),
  });
  const items = data?.items.filter((item) => item.roomId === null) ?? [];

  return (
    <SettingItem
      row="party-controls"
      description={tOr('settings.rowDescription', { row: 'party-controls' }, '')}
      stacked
    >
      {isError && <p role="alert">{tOr('party.controlsLoadFailed', {}, '')}</p>}
      {data && items.length === 0 && <PartyControlsList.Empty />}
      {items.length > 0 && (
        <PartyControlsList.Root>
          {items.map((item) => (
            <PartyControlsList.Item
              key={item.targetKey}
              name={item.targetKey}
              disabled={remove.isPending}
              onRemove={() => remove.mutate(item)}
            />
          ))}
        </PartyControlsList.Root>
      )}
    </SettingItem>
  );
}
