import { ChannelRow } from '#app/features/channel/components/channel-row/channel-row';
import type { ChannelHit } from '#app/features/search/utils/search-hits';
import { MatchedText } from '../matched-text/matched-text';

export interface ChannelResultHeaderProps {
  channel: ChannelHit;
  terms: readonly string[];
}

/** A channel among the search results, or the spotlight above them: its row with the bio's matches marked. */
export function ChannelResultHeader({ channel, terms }: ChannelResultHeaderProps) {
  return (
    <ChannelRow
      channel={channel}
      bio={channel.bio && <MatchedText text={channel.bio} terms={terms} />}
    />
  );
}
