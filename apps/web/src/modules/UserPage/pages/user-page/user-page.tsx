import { Navigate, useParams } from 'react-router-dom';

import styles from './user-page.module.scss';

import { useChannelQuery, useMyVideosQuery } from 'src/modules/shared/api';

import { useInfiniteScroll, useIsView } from 'src/modules/shared/hooks';
import { useAuth } from 'src/modules/shared/providers';

import { LoadingSpinner, VideosContainer } from "src/modules/shared/components";
import { UserDetails } from '../../components';

export function UserPage() {
	const { channelId } = useParams();
	const { account } = useAuth();
	const [isListView, setIsListView] = useIsView();

	const { data: channel, isFetching } = useChannelQuery(channelId ?? '', { skip: !channelId });

	const isOwnChannel = !!channelId && account?.channel.id === channelId;
	const { loadMore, queryData } = useInfiniteScroll(useMyVideosQuery, { limit: 30 });

	if (!channelId) return <Navigate to="/" replace />
	if (isFetching) return <LoadingSpinner />
	if (!channel) return null;

	return (
		<div className={styles.container}>
			<UserDetails channel={channel} />
			{isOwnChannel &&
				<>
					<div className={styles.container__header}>
						<h3>Your videos:</h3>
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
				</>
			}
		</div>
	)
}

export default UserPage;
