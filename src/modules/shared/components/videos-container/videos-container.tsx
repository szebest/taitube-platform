import { memo } from 'react';

import styles from './videos-container.module.scss';

import { LoadingSpinner, IsVisibleContainer, VideoCard } from '..';

import { Video } from "../../models";
import { PaginatedResponse } from 'src/models';

export type VideosContainerProps = {
	inView?: () => void;
	isFetching?: boolean;
	isLoading?: boolean;
	isError?: boolean;
	isListView?: boolean;
	refetch?: () => unknown;
	data?: PaginatedResponse<Video> | undefined;
}

export const VideosContainer = memo(function VideosContainer({ 
	inView = () => {}, 
	refetch = () => {}, 
	isFetching = false, 
	isLoading = false, 
	isError = false, 
	isListView = false, 
	data 
}: VideosContainerProps) {
	const RetryButton = 
		<div className={styles.center}>
			<button type="button" className="btn btn-danger" onClick={() => refetch()}>Retry</button>
		</div>;

  return (
		<>
			<div>
				{isLoading && <LoadingSpinner />}
				{!isLoading && isError && !data && <div>{RetryButton}</div>}
				{data &&
					<>
						<div className={`${styles.container} ${isListView ? styles.list : styles.gallery}`}>
							{
								data.data.map((video, index) => (
									<VideoCard key={video.id ?? index} video={video} />
								))
							}
						</div>
						{isFetching && <LoadingSpinner />}
						{isError && <div>{RetryButton}</div>}
					</>
				}
			</div>
			{!isFetching && data && data.data.length < data.count && <IsVisibleContainer inView={inView} />}
		</>
	)
});

export default VideosContainer;
