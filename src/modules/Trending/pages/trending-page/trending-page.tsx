import { useCallback, useEffect, useState } from 'react';

import { useLocalStorage } from '@uidotdev/usehooks';

import styles from './trending-page.module.scss';

import { useTrendingVideosQuery } from '../../api';

import { VideosContainer } from "src/modules/shared/components";
import { PaginatedQueryParams } from 'src/models';
import { IN_VIEW_LOCAL_STORAGE_KEY } from 'src/config';

export function TrendingPage() {
	const [query, setQuery] = useState<PaginatedQueryParams>({ pageNumber: 0, pageSize: 60 });
	const [isListView, setIsListView] = useLocalStorage(IN_VIEW_LOCAL_STORAGE_KEY, false);
  const queryData = useTrendingVideosQuery(query);
	
	const { isFetching, originalArgs } = queryData;

	const loadMore = useCallback(() => {
		if (isFetching) return;

		setQuery(prev => ({ ...prev, pageNumber: prev.pageNumber + 1 }));
	}, [isFetching]);

	useEffect(() => {
		if (!originalArgs) return;
		
		setQuery(originalArgs);
	}, [originalArgs])

  return (
    <div className={styles.container}>
			<div className={styles.container__header}>
      	<h3>Trending videos:</h3>
				<div className={styles.container__header__settings}>
					<button className='btn btn-round btn-list-view' onClick={() => setIsListView(false)}>
						<i className={`bi bi-grid-3x2-gap${!isListView ? '-fill' : ''}`}></i>
					</button>
					<button className='btn btn-round btn-list-view' onClick={() => setIsListView(true)}>
						<i className={`bi bi-list ${isListView ? styles.selected : ''}`}></i>
					</button>
				</div>
			</div>
      <VideosContainer inView={loadMore} {...queryData} isListView={isListView} />
    </div>
  )
}

export default TrendingPage;
