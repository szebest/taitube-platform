import { Navigate, useParams } from 'react-router-dom';

import styles from './user-page.module.scss';

import { useChannelQuery } from 'src/modules/shared/api';

import { LoadingSpinner } from "src/modules/shared/components";
import { UserDetails } from '../../components';

export function UserPage() {
	const { channelId } = useParams();
	const { data: channel, isFetching } = useChannelQuery(channelId ?? '', { skip: !channelId });

	if (!channelId) return <Navigate to="/" replace />
	if (isFetching) return <LoadingSpinner />
	if (!channel) return null;

	return (
		<div className={styles.container}>
			<UserDetails channel={channel} />
			<div className={styles.container__header}>
				<h3>{channel.displayName}'s channel</h3>
			</div>
		</div>
	)
}

export default UserPage;
