import { useCallback, useEffect, useState } from 'react';

import { useLocalStorage } from '@uidotdev/usehooks';

import styles from './all-video-page.module.scss';

import { useAllVideosQuery } from '../../api';

import { IN_VIEW_LOCAL_STORAGE_KEY } from 'src/config';

import { useQuery } from 'src/modules/shared/hooks';

import { VideosContainer } from "src/modules/shared/components";

import { VideosQueryParams } from '../../models';
import { CategoryList } from '../../components';

export function AllVideosPage() {
	const URLSearchQuery = useQuery();
	const searchText = URLSearchQuery.get("search") ?? "";

	const [query, setQuery] = useState<VideosQueryParams>({ 
		pageNumber: 0, 
		pageSize: 30, 
		searchText: searchText.length > 0 ? searchText : undefined,
		categoryId: undefined
	});
	const [isListView, setIsListView] = useLocalStorage(IN_VIEW_LOCAL_STORAGE_KEY, false);
  const queryData = useAllVideosQuery(query);
	
	const { isFetching, originalArgs } = queryData;

	const loadMore = useCallback(() => {
		if (isFetching) return;

		setQuery(prev => ({ ...prev, pageNumber: prev.pageNumber + 1 }));
	}, [isFetching]);

	const onCategoryChange = useCallback((categoryId: number | undefined) => {
		setQuery(prev => ({ ...prev, categoryId }));
	}, []);

	useEffect(() => {
		setQuery(prev => ({ ...prev, pageNumber: 0, searchText: searchText.length > 0 ? searchText : undefined }));
	}, [searchText]);

	useEffect(() => {
		if (!originalArgs) return;
		
		setQuery(originalArgs);
	}, [originalArgs]);

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
