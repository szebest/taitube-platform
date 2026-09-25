import { memo } from 'react';

import styles from './user-details.module.scss';

import type { Channel } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';

import { ProfilePicture, SubscribeButton } from 'src/modules/shared/components';

export type UserDetailsProps = {
	channel: Channel;
}

export const UserDetails = memo(({ channel }: UserDetailsProps) => {
	const { tOr } = useT();

	return (
		<div className={styles.container}>
			<div>
				<ProfilePicture src={channel.avatarUrl} />
			</div>
			<div className={styles.container__wrapper}>
				<h2 title={channel.displayName}>{channel.displayName}</h2>
				<div className={styles.textWrapper}>
					<span>{tOr('channels.subscribers', { count: channel.subscriberCount }, '')}</span>
				</div>
				<SubscribeButton channelId={channel.id} />
			</div>
		</div>
	)
});
