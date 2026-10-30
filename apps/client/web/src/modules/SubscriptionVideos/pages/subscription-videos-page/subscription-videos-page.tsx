import { PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import styles from './subscription-videos-page.module.scss';

import { subscriptionFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { useVideoPages } from '#app/hooks/use-video-pages';
import { useIsView } from '#app/modules/shared/hooks';

import { VideosContainer } from '#app/modules/shared/components';

export function SubscriptionVideosPage() {
  const [isListView, setIsListView] = useIsView();
  const api = useApi();
  const { tOr } = useT();
  const feed = useVideoPages(subscriptionFeedQueryOptions(api));

  return (
    <div className={styles.container}>
      <div className={styles.container__header}>
        <PageHeader.Root>
          <PageHeader.Title asChild>
            <h1>{tOr('channels.subscriptionVideosTitle', {}, '')}</h1>
          </PageHeader.Title>
        </PageHeader.Root>
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
      <VideosContainer {...feed} isListView={isListView} />
    </div>
  );
}
