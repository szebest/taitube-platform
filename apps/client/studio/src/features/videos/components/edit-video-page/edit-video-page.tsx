import { PageHeader } from '@kit/components';
import { useT } from '@kit/intl-react';
import { Tabs } from '@kit/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { canManageCaptions } from '@vp/permissions';
import { Can } from '@vp/permissions-react';
import { useApi, videoQueryOptions } from '@vp/queries';
import type { ReactNode } from 'react';
import { parseEditTab } from '#app/features/videos/utils/edit-tabs';
import { ChaptersPanel } from '../chapters-panel/chapters-panel';
import { CorrectionsPanel } from '../corrections-panel/corrections-panel';
import { EditVideoForm } from '../edit-video-form/edit-video-form';
import { HistoryPanel } from '../history-panel/history-panel';
import { VideoProcessingStatus } from '../video-processing-status/video-processing-status';
import { VideoScreeningPanel } from '../video-screening-panel/video-screening-panel';

export type EditVideoPageProps = {
  videoId: string;
  /** The video's captions, shown to whoever may manage them. */
  captions: ReactNode;
};

export function EditVideoPage({ videoId, captions }: EditVideoPageProps) {
  const api = useApi();
  const { data: video } = useSuspenseQuery(videoQueryOptions(api, videoId));
  const { tOr } = useT();
  const navigate = useNavigate({ from: '/videos/$videoId/edit' });
  const { tab } = useSearch({ from: '/_authed/videos/$videoId/edit' });

  return (
    <div className="flex flex-col gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.editTitle', { title: video.title ?? '' }, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      <VideoProcessingStatus videoId={videoId} />
      <VideoScreeningPanel video={video} />
      <Tabs.Root
        value={tab ?? 'details'}
        onValueChange={(next) => {
          const known = parseEditTab(next);
          if (known)
            void navigate({ search: (previous) => ({ ...previous, tab: known }), replace: true });
        }}
      >
        <Tabs.List aria-label={tOr('studio.editTabs', {}, '')}>
          <Tabs.Tab value="details">{tOr('studio.editTabDetails', {}, '')}</Tabs.Tab>
          <Tabs.Tab value="chapters">{tOr('studio.editTabChapters', {}, '')}</Tabs.Tab>
          <Tabs.Tab value="corrections">{tOr('studio.editTabCorrections', {}, '')}</Tabs.Tab>
          <Tabs.Tab value="history">{tOr('studio.editTabHistory', {}, '')}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="details" className="flex flex-col gap-section">
          <EditVideoForm video={video} />
          <Can
            type="rule"
            I={canManageCaptions}
            this={{
              caption: { videoId, ownerId: video.ownerId, visibility: video.visibility },
            }}
          >
            {captions}
          </Can>
        </Tabs.Panel>
        <Tabs.Panel value="chapters">
          <ChaptersPanel video={video} />
        </Tabs.Panel>
        <Tabs.Panel value="corrections">
          <CorrectionsPanel video={video} />
        </Tabs.Panel>
        <Tabs.Panel value="history">
          <HistoryPanel video={video} />
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  );
}
