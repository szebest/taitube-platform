import styles from './comments-section.module.scss';

import { useGetVideoCommentsQuery } from '../../api/videoApiSlice';

import { useInfiniteScroll } from 'src/modules/shared/hooks';

import { IsVisibleContainer, LoadingSpinner } from 'src/modules/shared/components';
import { AddVideoComment, VideoComments } from '..';

export type CommentsSectionProps = {
	videoId: number;
}

export const CommentsSection = ({ videoId }: CommentsSectionProps) => {
	const { loadMore, queryData: { data, isFetching, isLoading, isError } } = useInfiniteScroll(useGetVideoCommentsQuery, { pageNumber: 0, pageSize: 10, videoId });

	return (
		<div className={styles.container}>
			<AddVideoComment videoId={videoId} loadingComments={isLoading || isError} />
			{isLoading ?
				<LoadingSpinner /> :
				<>
					{isError ?
						<div>There was an error while loading the comments...</div> :
						<VideoComments data={data!.data} />
					}
				</>
			}
			{isFetching && !isLoading && <LoadingSpinner />}
			{!isFetching && data && data.data.length < data.count && <IsVisibleContainer inView={loadMore} rootMargin='50px' />}
		</div>
	)
}

export default CommentsSection;