import { useCallback, useEffect, useState } from 'react';

import styles from './all-video-page.module.scss';

import { useAllVideosQuery } from '../../api';

import { Icon, VideosContainer } from "src/modules/shared/components";
import { PaginatedQueryParams } from 'src/models';

export function AllVideosPage() {
	const [query, setQuery] = useState<PaginatedQueryParams>({ pageNumber: 0, pageSize: 60 });
	const [isListView, setIsListView] = useState(false);
  const queryData = useAllVideosQuery(query);
	
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
      	<h3>All video files:</h3>
				<div className={styles.container__header__settings}>
					<button className='btn btn-round btn-list-view' onClick={() => setIsListView(false)}>
						<i className={`bi bi-grid-3x2-gap${!isListView ? '-fill' : ''}`}></i>
					</button>
					<button className='btn btn-round btn-list-view' onClick={() => setIsListView(true)}>
						<i className={`bi bi-list ${isListView ? styles.selected : ''}`}></i>
					</button>
				</div>
			</div>
      <VideosContainer inView={() => loadMore()} {...queryData} isListView={isListView} />
    </div>
  )
}

export default AllVideosPage;
