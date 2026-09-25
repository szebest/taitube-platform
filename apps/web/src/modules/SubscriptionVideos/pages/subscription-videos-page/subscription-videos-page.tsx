import styles from './subscription-videos-page.module.scss';

import { feedApi } from '#app/modules/shared/api';

import { useInfiniteScroll, useIsView } from '#app/modules/shared/hooks';

import { VideosContainer } from "#app/modules/shared/components";

export function SubscriptionVideosPage() {
	const [isListView, setIsListView] = useIsView();
	const { loadMore, queryData } = useInfiniteScroll(feedApi.useSubscriptionFeedQuery, { limit: 30 });

	return (
		<div className={styles.container}>
			<div className={styles.container__header}>
				<h3>Subscription videos:</h3>
				<div className={styles.container__header__settings}>
					<button type="button" className='btn btn-transparent btn-round btn-list-view' onClick={() => setIsListView(false)} aria-label="grid view">
						<i className={`bi bi-grid-3x2-gap${!isListView ? '-fill' : ''}`} />
					</button>
					<button type="button" className='btn btn-transparent btn-round btn-list-view' onClick={() => setIsListView(true)} aria-label="list view">
						<i className={`bi bi-list ${isListView ? styles.selected : ''}`} />
					</button>
				</div>
			</div>
			<VideosContainer inView={loadMore} {...queryData} isListView={isListView} />
		</div>
	)
}
