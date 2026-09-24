import styles from './trending-page.module.scss';

import type { PublicFeedQuery } from 'src/modules/shared/api';
import { usePublicFeedQuery } from 'src/modules/shared/api';

import { useInfiniteScroll, useIsView } from 'src/modules/shared/hooks';

import { VideosContainer } from "src/modules/shared/components";

export function TrendingPage() {
	const [isListView, setIsListView] = useIsView();
	const initialQuery: PublicFeedQuery = { sort: 'trending', limit: 30 };
	const { loadMore, queryData } = useInfiniteScroll(usePublicFeedQuery, initialQuery);

	return (
		<div className={styles.container}>
			<div className={styles.container__header}>
				<h3>Trending videos:</h3>
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
