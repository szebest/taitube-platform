import { startTransition, useCallback, useState } from 'react';

import styles from './all-video-page.module.scss';

import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { useVideoPages } from '#app/hooks/use-video-pages';
import { useIsView } from '#app/modules/shared/hooks';

import { VideosContainer } from "#app/modules/shared/components";

import { CategoryList } from '#app/modules/AllVideosPage/components';

export function AllVideosPage() {
	const [isListView, setIsListView] = useIsView();
	const [categoryId, setCategoryId] = useState<string | undefined>();
	const feed = useVideoPages(publicFeedQueryOptions({ sort: 'recent', categoryId }));

	const onCategoryChange = useCallback((categoryId: string | undefined) => {
		startTransition(() => setCategoryId(categoryId));
	}, []);

	return (
		<div className={styles.container}>
			<CategoryList onCategoryChange={onCategoryChange} selectedCategoryId={categoryId} />
			<div className={styles.container__header}>
				<h3>All videos:</h3>
				<div className={styles.container__header__settings}>
					<button type="button" className='btn btn-transparent btn-round btn-list-view' onClick={() => setIsListView(false)} aria-label="grid view">
						<i className={`bi bi-grid-3x2-gap${!isListView ? '-fill' : ''}`} />
					</button>
					<button type="button" className='btn btn-transparent btn-round btn-list-view' onClick={() => setIsListView(true)} aria-label="list view">
						<i className={`bi bi-list ${isListView ? styles.selected : ''}`} />
					</button>
				</div>
			</div>
			<VideosContainer {...feed} isListView={isListView} />
		</div>
	)
}
