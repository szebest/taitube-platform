import styles from './trending-page.module.scss';

import { useTrendingVideosQuery } from '../../api';

import { useIsView, useInfiniteScroll } from 'src/modules/shared/hooks';

import { VideosContainer } from "src/modules/shared/components";

export function TrendingPage() {
	const [isListView, setIsListView] = useIsView();
	const { loadMore, queryData } = useInfiniteScroll(useTrendingVideosQuery, { pageNumber: 0, pageSize: 30 });

	return (
		<div className={styles.container}>
			<div className={styles.container__header}>
				<h3>Trending videos:</h3>
				<div className={styles.container__header__settings}>
					<button className='btn btn-transparent btn-round btn-list-view' onClick={() => setIsListView(false)} aria-label="grid view">
						<i className={`bi bi-grid-3x2-gap${!isListView ? '-fill' : ''}`}></i>
					</button>
					<button className='btn btn-transparent btn-round btn-list-view' onClick={() => setIsListView(true)} aria-label="list view">
						<i className={`bi bi-list ${isListView ? styles.selected : ''}`}></i>
					</button>
				</div>
			</div>
			<VideosContainer inView={loadMore} {...queryData} isListView={isListView} />
		</div>
	)
}

export default TrendingPage;
