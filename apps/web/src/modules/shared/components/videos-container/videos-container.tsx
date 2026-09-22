import { memo } from 'react';

import styles from './videos-container.module.scss';

import type { VideoSummary } from "@vp/api-contracts";

import { IsVisibleContainer, LoadingSpinner, VideoCard } from '..';

export type VideosContainerProps = {
	inView?: VoidFunction;
	isFetching?: boolean;
	isError?: boolean;
	isListView?: boolean;
	refetch?: () => unknown;
	data?: { items: VideoSummary[]; nextCursor: string | null } | undefined;
}

export const VideosContainer = memo(({
	inView = () => { },
	refetch = () => { },
	isFetching = false,
	isError = false,
	isListView = false,
	data
}: VideosContainerProps) => {
	return (
		<>
			<div className={styles.container}>
				{data &&
					<div className={`${isListView ? styles.list : styles.gallery}`}>
						{
							data.items.map((video, index, arr) => (
								<VideoCard key={video.id} video={video} zIndex={arr.length - index} />
							))
						}
					</div>
				}
				{isFetching && <LoadingSpinner />}
				{isError &&
					<div className={styles.center}>
						<button type="button" className="btn btn-danger" onClick={() => refetch()} aria-label="retry">Retry</button>
					</div>
				}
			</div>
			{!isFetching && data?.nextCursor && <IsVisibleContainer inView={inView} />}
		</>
	)
});

export default VideosContainer;
