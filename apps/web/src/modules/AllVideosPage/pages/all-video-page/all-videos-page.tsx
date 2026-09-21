import { useCallback } from 'react';

import styles from './all-video-page.module.scss';

import type { PublicFeedQuery } from 'src/modules/shared/api';
import { usePublicFeedQuery } from 'src/modules/shared/api';

import { useInfiniteScroll, useIsView } from 'src/modules/shared/hooks';

import { VideosContainer } from "src/modules/shared/components";

import { CategoryList } from '../../components';

export function AllVideosPage() {
	const [isListView, setIsListView] = useIsView();
	const initialQuery: PublicFeedQuery = { sort: 'recent', limit: 30 };
	const { loadMore, queryData, query, setQuery } = useInfiniteScroll(usePublicFeedQuery, initialQuery);

	const onCategoryChange = useCallback((categoryId: string | undefined) => {
		setQuery(prev => ({ ...prev, categoryId, cursor: undefined }));
	}, [setQuery]);

	return (
		<div className={styles.container}>
			<CategoryList onCategoryChange={onCategoryChange} selectedCategoryId={query.categoryId} />
			<div className={styles.container__header}>
				<h3>All videos:</h3>
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

export default AllVideosPage;
