import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useLocalStorage } from '@uidotdev/usehooks';

import styles from './user-page.module.scss';

import { IN_VIEW_LOCAL_STORAGE_KEY } from 'src/config';

import { useGetUserDetailsQuery, useGetUserVideosQuery } from '../../api';

import { LoadingSpinner, VideosContainer } from "src/modules/shared/components";
import { UserDetails } from '../../components';

import { UserVideosRequestParams } from '../../models';

export type UserPageProps = {
  param?: number;
}

export function UserPage({ param }: UserPageProps) {
	const [query, setQuery] = useState<UserVideosRequestParams>({ pageNumber: 0, pageSize: 60, userId: param });
	const [isListView, setIsListView] = useLocalStorage(IN_VIEW_LOCAL_STORAGE_KEY, false);
  const queryData = useGetUserVideosQuery({...query, userId: param});
	const { data: userDetails, isFetching: userDetailsFetching } = useGetUserDetailsQuery(param);

	const { data, isFetching, originalArgs } = queryData;
	
	const loadMore = useCallback(() => {
		if (isFetching) return;

		setQuery(prev => ({ ...prev, pageNumber: prev.pageNumber + 1 }));
	}, [isFetching]);

	useEffect(() => {
		if (!originalArgs) return;
		
		setQuery(originalArgs);
	}, [originalArgs])

	useEffect(() => {
		if (param === query.userId) return;
		
		setQuery(prev => ({ ...prev, userId: param }));
	}, [param])

	if (param === undefined) return <Navigate to="/" replace/>
	if (userDetailsFetching || isFetching) return <LoadingSpinner />
	if (!userDetails || !data) return null;

  return (
    <div className={styles.container}>
			<UserDetails details={userDetails} userId={param} videosCount={data.count} />
			<div className={styles.container__header}>
      	<h3>{userDetails.userFullName}'s videos:</h3>
				<div className={styles.container__header__settings}>
					<button className='btn btn-round btn-list-view' onClick={() => setIsListView(false)} aria-label="grid view">
						<i className={`bi bi-grid-3x2-gap${!isListView ? '-fill' : ''}`}></i>
					</button>
					<button className='btn btn-round btn-list-view' onClick={() => setIsListView(true)} aria-label="list view">
						<i className={`bi bi-list ${isListView ? styles.selected : ''}`}></i>
					</button>
				</div>
			</div>
      <VideosContainer inView={loadMore} {...queryData} isListView={isListView} />
    </div>
  )
}

export default UserPage;
