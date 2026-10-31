import { useSuspenseQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { myVideosQueryOptions, useAccount, useApi } from '@vp/queries';
import { Suspense } from 'react';
import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { ChannelStartHere } from '#app/features/channels/components/channel-start-here';
import { useVideoPages } from '#app/hooks/use-video-pages';
import { LoadingSpinner, VideosContainer } from '#app/modules/shared/components';

import { useIsView } from '#app/modules/shared/hooks';
import { UserDetails } from '#app/modules/UserPage/components';
import styles from './user-page.module.scss';

function MyVideos({ isListView }: { isListView: boolean }) {
  const api = useApi();
  const videos = useVideoPages(myVideosQueryOptions(api));

  return <VideosContainer {...videos} isListView={isListView} />;
}

export function UserPage() {
  const { channelId } = useParams({ from: '/channel/$channelId' });
  const account = useAccount();
  const [isListView, setIsListView] = useIsView();
  const api = useApi();

  const { data: channel } = useSuspenseQuery(channelQueryOptions(api, channelId));

  const isOwnChannel = account?.channel.id === channelId;

  return (
    <div className={styles.container}>
      <UserDetails channel={channel} />
      <ChannelStartHere channelId={channelId} />
      {isOwnChannel && (
        <>
          <div className={styles.container__header}>
            <h3>Your videos:</h3>
            <div className={styles.container__header__settings}>
              <button
                type="button"
                className="btn btn-transparent btn-round btn-list-view"
                onClick={() => setIsListView(false)}
                aria-label="grid view"
              >
                <i className={`bi bi-grid-3x2-gap${!isListView ? '-fill' : ''}`} />
              </button>
              <button
                type="button"
                className="btn btn-transparent btn-round btn-list-view"
                onClick={() => setIsListView(true)}
                aria-label="list view"
              >
                <i className={`bi bi-list ${isListView ? styles.selected : ''}`} />
              </button>
            </div>
          </div>
          <Suspense fallback={<LoadingSpinner />}>
            <MyVideos isListView={isListView} />
          </Suspense>
        </>
      )}
    </div>
  );
}
