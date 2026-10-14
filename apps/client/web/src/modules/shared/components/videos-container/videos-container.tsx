import { memo } from 'react';

import styles from './videos-container.module.scss';

import type { VideoSummary } from "@vp/api-contracts";

import { IsVisibleContainer, LoadingSpinner, VideoCard } from '..';

export type VideosContainerProps = {
	videos?: VideoSummary[];
	hasMore?: boolean;
	loadMore?: VoidFunction;
	isFetching?: boolean;
	isError?: boolean;
	retry?: VoidFunction;
	isListView?: boolean;
}

export const VideosContainer = memo(({
	videos,
	hasMore = false,
	loadMore = () => { },
	isFetching = false,
	isError = false,
	retry = () => { },
	isListView = false,
}: VideosContainerProps) => {
	return (
		<>
			<div className={styles.container}>
				{videos &&
					<div className={`${isListView ? styles.list : styles.gallery}`}>
						{
							videos.map((video, index, arr) => (
								<VideoCard key={video.id} video={video} zIndex={arr.length - index} />
							))
						}
					</div>
				}
				{isFetching && <LoadingSpinner />}
				{isError &&
					<div className={styles.center}>
						<button type="button" className="btn btn-danger" onClick={retry} aria-label="retry">Retry</button>
					</div>
				}
			</div>
			{!isFetching && hasMore && <IsVisibleContainer inView={loadMore} />}
		</>
	)
});
