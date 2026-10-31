import { useQuery } from '@tanstack/react-query';
import type { Channel, ChannelFeaturedView } from '@vp/api-contracts';
import { FEATURED_VIDEOS_MAX } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';

import { featuredQueryOptions } from '../api/channel-featured';
import { useFeaturedDraft } from '../hooks/use-featured-draft';
import { useSaveFeatured } from '../hooks/use-save-featured';
import { CustomizationSection } from './customization-section';
import { StartHerePicker } from './start-here-picker';
import { StartHerePins } from './start-here-pins';
import { StartHerePreview } from './start-here-preview';

function StartHereEditor({ channel, saved }: { channel: Channel; saved: ChannelFeaturedView }) {
  const { tOr } = useT();
  const draft = useFeaturedDraft(saved.source === 'pinned' ? saved.items : []);
  const { save, saving, saved: justSaved } = useSaveFeatured(channel.id);

  return (
    <CustomizationSection.Root
      onSubmit={(event) => {
        event.preventDefault();
        save(draft.pins);
      }}
    >
      <CustomizationSection.Header>
        <CustomizationSection.Title>
          {tOr('studio.startHereTitle', {}, '')}
        </CustomizationSection.Title>
        <CustomizationSection.Description>
          {tOr('studio.startHereDescription', { max: FEATURED_VIDEOS_MAX }, '')}
        </CustomizationSection.Description>
      </CustomizationSection.Header>
      <CustomizationSection.Body>
        {draft.pins.length === 0 ? (
          <p className="tw:m-0 tw:text-fg-muted">{tOr('studio.startHereEmptyNote', {}, '')}</p>
        ) : (
          <>
            <StartHerePins pins={draft.pins} onReorder={draft.reorder} onRemove={draft.remove} />
            <StartHerePreview channelId={channel.id} pins={draft.pins} />
          </>
        )}
        <div className="tw:flex tw:items-center tw:gap-stack">
          <StartHerePicker pinned={draft.pins} disabled={draft.full} onPick={draft.add} />
          {draft.full && (
            <p className="tw:m-0 tw:text-caption tw:text-fg-muted">
              {tOr('studio.startHereLimit', { max: FEATURED_VIDEOS_MAX }, '')}
            </p>
          )}
        </div>
      </CustomizationSection.Body>
      <CustomizationSection.Footer
        saving={saving}
        saved={justSaved && !draft.dirty}
        disabled={!draft.dirty}
      />
    </CustomizationSection.Root>
  );
}

/** The videos a newcomer should watch first: pinned, ordered, previewed as the channel page shows them. */
export function StartHereSection({ channel }: { channel: Channel }) {
  const { data } = useQuery(featuredQueryOptions(useApi(), channel.id));

  return data === undefined ? null : <StartHereEditor channel={channel} saved={data} />;
}
