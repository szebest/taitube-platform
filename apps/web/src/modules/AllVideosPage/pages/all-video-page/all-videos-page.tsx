import { useCallback, useEffect } from 'react';

import styles from './all-video-page.module.scss';

import { useAllVideosQuery } from '../../api';

import { useInfiniteScroll, useIsView, useQuery } from 'src/modules/shared/hooks';

import { VideosContainer } from "src/modules/shared/components";

import { CategoryList } from '../../components';

export function AllVideosPage() {
	const URLSearchQuery = useQuery();
	const searchText = URLSearchQuery.get("search") ?? "";

	const [isListView, setIsListView] = useIsView();
	const { loadMore, queryData, query, setQuery } = useInfiniteScroll(useAllVideosQuery, { 
		pageNumber: 0, 
		pageSize: 30,
		searchText: searchText.length > 0 ? searchText : undefined,
		categoryId: undefined
	});

	const onCategoryChange = useCallback((categoryId: number | undefined) => {
		setQuery(prev => ({ ...prev, categoryId, pageNumber: 0 }));
	}, []);

	useEffect(() => {
		setQuery(prev => ({ ...prev, pageNumber: 0, searchText: searchText.length > 0 ? searchText : undefined }));
	}, [searchText]);

	return (
		<div className={styles.container}>
			<CategoryList onCategoryChange={onCategoryChange} selectedCategoryId={query.categoryId} />
			<div className={styles.container__header}>
				<h3>{searchText.length === 0 ? 'All videos:' : `Search results for: '${searchText}'`}</h3>
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
