import { useCallback, useEffect, useState } from 'react';

import { useLocalStorage } from '@uidotdev/usehooks';

import styles from './trending-page.module.scss';

import { useTrendingVideosQuery } from '../../api';

import { VideosContainer } from "src/modules/shared/components";
import { PaginatedQueryParams } from 'src/models';
import { IN_VIEW_LOCAL_STORAGE_KEY } from 'src/config';

export function TrendingPage() {
	const [blockInit, setBlockInit] = useState(true);

	const [query, setQuery] = useState<PaginatedQueryParams>({ pageNumber: 0, pageSize: 30 });
	const [isListView, setIsListView] = useLocalStorage(IN_VIEW_LOCAL_STORAGE_KEY, false);
	const queryData = useTrendingVideosQuery(query);

	const { isFetching } = queryData;

	const loadMore = useCallback(() => {
		if (isFetching) return;

		setQuery(prev => ({ ...prev, pageNumber: (queryData.currentData?.pageNumber ?? 0) + 1 }));
	}, [isFetching, queryData]);

	useEffect(() => {
		if (isFetching) return;

		if (blockInit) {
			setBlockInit(true);
			return;
		}

		queryData.refetch();
	}, [query])

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
