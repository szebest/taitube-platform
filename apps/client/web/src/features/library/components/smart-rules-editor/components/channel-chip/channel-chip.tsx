import { Chip, Icon } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import type { ChannelDraft } from '#app/features/library/utils/rules-form';
import { useT } from '#app/lib/messages';
import { channelQueryOptions } from '#app/lib/query-keys/channel-keys';

export interface ChannelChipProps {
  channel: ChannelDraft;
  onRemove: () => void;
}

/** A picked channel; one that came with saved rules reads its name first. */
export function ChannelChip({ channel, onRemove }: ChannelChipProps) {
  const { tOr } = useT();
  const read = useQuery({
    ...channelQueryOptions(useApi(), channel.id),
    enabled: channel.displayName === null,
  });

  const name =
    channel.displayName ?? read.data?.displayName ?? tOr('playlistPeople.someone', {}, '');

  return (
    <Chip
      type="button"
      aria-label={tOr('playlistTools.removeChannel', { name }, '')}
      onClick={onRemove}
    >
      {name}
      <Icon name="close" size="sm" />
    </Chip>
  );
}
