import { useCallback, useEffect, useState } from 'react';

import styles from './comments-section.module.scss';

import { useGetVideoCommentsQuery } from '../../api/videoApiSlice';

import { PaginatedQueryParams } from 'src/models';

import { IsVisibleContainer, LoadingSpinner } from 'src/modules/shared/components';
import { AddVideoComment, VideoComments } from '..';

export type CommentsSectionProps = {
	videoId: number;
}

export const CommentsSection = ({ videoId }: CommentsSectionProps) => {
	const [query, setQuery] = useState<PaginatedQueryParams>({ pageNumber: 0, pageSize: 10 });
	const { data, isFetching, isLoading, isError, currentData } = useGetVideoCommentsQuery({ videoId, queryParams: query });

	const loadMore = useCallback(() => {
		if (isFetching) return;

		setQuery(prev => ({ ...prev, pageNumber: (currentData?.pageNumber ?? 0) + 1 }));
	}, [isFetching]);

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