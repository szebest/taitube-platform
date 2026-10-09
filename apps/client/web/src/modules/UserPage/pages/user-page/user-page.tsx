import { useSuspenseQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { Suspense } from 'react';

import styles from './user-page.module.scss';

import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { myVideosQueryOptions } from '#app/features/videos/api/video-queries';
import { useVideoPages } from '#app/hooks/use-video-pages';

import { useIsView } from '#app/modules/shared/hooks';
import { useAuth } from '#app/modules/shared/providers';

import { LoadingSpinner, VideosContainer } from "#app/modules/shared/components";
import { UserDetails } from '#app/modules/UserPage/components';

function MyVideos({ isListView }: { isListView: boolean }) {
	const videos = useVideoPages(myVideosQueryOptions());

	return <VideosContainer {...videos} isListView={isListView} />
}

export function UserPage() {
	const { channelId } = useParams({ from: '/channel/$channelId' });
	const { account } = useAuth();
	const [isListView, setIsListView] = useIsView();

	const { data: channel } = useSuspenseQuery(channelQueryOptions(channelId));

	const isOwnChannel = account?.channel.id === channelId;

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
					<Suspense fallback={<LoadingSpinner />}>
						<MyVideos isListView={isListView} />
					</Suspense>
				</>
			}
		</div>
	)
}
