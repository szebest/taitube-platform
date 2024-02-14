import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

import styles from './user-page.module.scss';

import { useGetUserDetailsQuery, useGetUserVideosQuery } from '../../api';

import { useInfiniteScroll, useIsView } from 'src/modules/shared/hooks';

import { LoadingSpinner, VideosContainer } from "src/modules/shared/components";
import { UserDetails } from '../../components';

export type UserPageProps = {
	userId?: number;
}

export function UserPage({ userId }: UserPageProps) {
	const [isListView, setIsListView] = useIsView();
	const { loadMore, queryData, query, setQuery } = useInfiniteScroll(useGetUserVideosQuery, { pageNumber: 0, pageSize: 30, userId });
	const { data: userDetails, isFetching: userDetailsFetching } = useGetUserDetailsQuery(userId ?? -1, { skip: userId === undefined });

	const { data, isFetching } = queryData;

	useEffect(() => {
		if (userId === query.userId) return;

		setQuery(prev => ({ ...prev, userId: userId }));
	}, [userId])

	if (userId === undefined) return <Navigate to="/" replace />
	if (userDetailsFetching || isFetching) return <LoadingSpinner />
	if (!userDetails || !data) return null;

	return (
		<div className={styles.container}>
			<UserDetails details={userDetails} userId={userId} videosCount={data.count} />
			<div className={styles.container__header}>
				<h3>{userDetails.userFullName}'s videos:</h3>
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

export default UserPage;
