import { SegmentedControl } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { useApi, useAppLink } from '@vp/queries';
import { useState } from 'react';
import { pageChannelQueryOptions } from '#app/features/page-builder/api/page-sources';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { WEB_URL } from '#app/lib/config';
import { useT } from '#app/lib/messages';

const VIEWS = ['visitor', 'subscriber', 'mobile'] as const;
type PreviewView = (typeof VIEWS)[number];

const MOBILE_WIDTH_PX = 390;

const isView = (value: string): value is PreviewView => VIEWS.some((view) => view === value);

export interface PreviewPaneProps {
  /** Changes with every save, so the frame loads the page again. */
  version: number;
}

/** The channel page as web draws it from the draft, for a new visitor, a subscriber, or on a phone's width. */
export function PreviewPane({ version }: PreviewPaneProps) {
  const { tOr } = useT();
  const appLink = useAppLink();
  const { channelId } = useActiveChannel();
  const [view, setView] = useState<PreviewView>('visitor');
  const channel = useQuery(pageChannelQueryOptions(useApi(), channelId));
  const audience = view === 'subscriber' ? 'subscriber' : 'visitor';
  const src =
    channel.data === undefined
      ? undefined
      : appLink(
          WEB_URL,
          `/channels/${channel.data.handle}?preview=draft&as=${audience}&v=${version}`
        );

  return (
    <section
      aria-label={tOr('studio.pagePreviewLabel', {}, '')}
      className="flex flex-col gap-stack"
    >
      <SegmentedControl.Root
        aria-label={tOr('studio.pagePreviewAs', {}, '')}
        value={view}
        onValueChange={(next) => isView(next) && setView(next)}
      >
        {VIEWS.map((choice) => (
          <SegmentedControl.Item key={choice} value={choice}>
            {tOr('studio.pagePreviewOption', { mode: choice }, '')}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
      {src !== undefined && (
        <iframe
          title={tOr('studio.pagePreviewFrame', { mode: view }, '')}
          src={src}
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
          className="mx-auto h-[40rem] w-full rounded-card border border-border"
          style={view === 'mobile' ? { maxWidth: MOBILE_WIDTH_PX } : undefined}
        />
      )}
    </section>
  );
}
