import { SMART_PLAYLIST_MAX_CHANNELS } from '@vp/domain';
import { ChannelPicker } from '#app/features/library/components/channel-picker/channel-picker';
import type { ChannelDraft } from '#app/features/library/utils/rules-form';
import { useT } from '#app/lib/messages';
import { ChannelChip } from '../channel-chip/channel-chip';

export interface ChannelOperandProps {
  channels: ChannelDraft[];
  onChange: (channels: ChannelDraft[]) => void;
}

/** The channels a condition matches, any of them, up to the rules' limit. */
export function ChannelOperand({ channels, onChange }: ChannelOperandProps) {
  const { tOr } = useT();

  const ids = channels.map(({ id }) => id);

  return (
    <div className="flex min-w-0 flex-1 basis-60 flex-col gap-inline">
      {channels.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
          {channels.map((channel) => (
            <li key={channel.id}>
              <ChannelChip
                channel={channel}
                onRemove={() => onChange(channels.filter(({ id }) => id !== channel.id))}
              />
            </li>
          ))}
        </ul>
      )}
      {channels.length < SMART_PLAYLIST_MAX_CHANNELS && (
        <ChannelPicker
          label={tOr('playlistTools.channelsLabel', { max: SMART_PLAYLIST_MAX_CHANNELS }, '')}
          exclude={ids}
          onPick={({ id, displayName }) => onChange([...channels, { id, displayName }])}
        />
      )}
    </div>
  );
}
