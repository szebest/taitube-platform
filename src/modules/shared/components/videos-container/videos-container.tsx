import { memo } from 'react';

import styles from './videos-container.module.scss';

import { LoadingSpinner, IsVisibleContainer, VideoCard } from '..';

import { Video } from "../../models";
import { PaginatedResponse } from 'src/models';

export type VideosContainerProps = {
	inView?: VoidFunction;
	isFetching?: boolean;
	isLoading?: boolean;
	isError?: boolean;
	isListView?: boolean;
	refetch?: () => unknown;
	currentData?: PaginatedResponse<Video> | undefined;
}

export const VideosContainer = memo(({ 
	inView = () => {}, 
	refetch = () => {}, 
	isFetching = false, 
	isLoading = false, 
	isError = false, 
	isListView = false, 
	currentData 
}: VideosContainerProps) => {
  return (
		<>
			<div className={styles.container}>
				{currentData &&
					<>
						<div className={`${isListView ? styles.list : styles.gallery}`}>
							{
								currentData.data.map((video, index) => (
									<VideoCard key={video.id ?? index} video={video} />
								))
							}
						</div>
					</>
				}
				{isFetching && <LoadingSpinner />}
				{isError && 
					<div className={styles.center}>
						<button type="button" className="btn btn-danger btn-white-text" onClick={() => refetch()} aria-label="retry">Retry</button>
					</div>
				}
			</div>
			{!isFetching && currentData && currentData.data.length < currentData.count && <IsVisibleContainer inView={inView} />}
		</>
	)
});

export default VideosContainer;
