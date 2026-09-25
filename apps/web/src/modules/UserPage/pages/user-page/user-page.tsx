import { useParams } from '@tanstack/react-router';

import styles from './user-page.module.scss';

import { accountApi, videosApi } from 'src/modules/shared/api';

import { useInfiniteScroll, useIsView } from 'src/modules/shared/hooks';
import { useAuth } from 'src/modules/shared/providers';

import { LoadingSpinner, VideosContainer } from "src/modules/shared/components";
import { UserDetails } from '../../components';

export function UserPage() {
	const { channelId } = useParams({ from: '/channel/$channelId' });
	const { account } = useAuth();
	const [isListView, setIsListView] = useIsView();

	const { data: channel, isFetching } = accountApi.useChannelQuery(channelId);

	const isOwnChannel = account?.channel.id === channelId;
	const { loadMore, queryData } = useInfiniteScroll(videosApi.useMyVideosQuery, { limit: 30 });

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
							<button type="button" className='btn btn-transparent btn-round btn-list-view' onClick={() => setIsListView(false)} aria-label="grid view">
								<i className={`bi bi-grid-3x2-gap${!isListView ? '-fill' : ''}`} />
							</button>
							<button type="button" className='btn btn-transparent btn-round btn-list-view' onClick={() => setIsListView(true)} aria-label="list view">
								<i className={`bi bi-list ${isListView ? styles.selected : ''}`} />
							</button>
						</div>
					</div>
					<VideosContainer inView={loadMore} {...queryData} isListView={isListView} />
				</>
			}
		</div>
	)
}
