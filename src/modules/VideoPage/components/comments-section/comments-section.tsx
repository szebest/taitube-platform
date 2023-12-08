import { useCallback, useEffect, useState } from 'react';

import styles from './comments-section.module.scss';

import { useGetVideoCommentsQuery } from '../../api/videoApiSlice';

import { PaginatedQueryParams } from 'src/models';
import { IsVisibleContainer, LoadingSpinner } from 'src/modules/shared/components';
import { AddVideoComment, VideoComments } from '..';
import { useAuth } from 'src/modules/shared/providers';

export type CommentsSectionProps = {
	videoId: number;
}

export const CommentsSection = ({ videoId }: CommentsSectionProps) => {
	const [query, setQuery] = useState<PaginatedQueryParams>({ pageNumber: 0, pageSize: 10 });
	const { user, isLoading: userIsLoading } = useAuth();
	const { data, isFetching, originalArgs, isLoading, isError } = useGetVideoCommentsQuery({ videoId, queryParams: query });

	const loadMore = useCallback(() => {
		if (isFetching) return;

		setQuery(prev => ({ ...prev, pageNumber: prev.pageNumber + 1 }));
	}, [isFetching]);

	useEffect(() => {
		if (!originalArgs || !originalArgs.queryParams) return;

		setQuery(originalArgs.queryParams);
	}, [originalArgs])

	return (
		<div className={styles.container}>
			{!userIsLoading && user && <AddVideoComment videoId={videoId} user={user} loadingComments={isLoading || isError} />}
			{isLoading ?
				<LoadingSpinner /> :
				<>
					{isError ?
						<div>There was an error while loading the comments...</div> :
						<VideoComments data={data!.data} />
					}
				</>
			}
			{!isFetching && data && data.data.length < data.count && <IsVisibleContainer inView={loadMore} />}
		</div>
	)
}

export default CommentsSection;