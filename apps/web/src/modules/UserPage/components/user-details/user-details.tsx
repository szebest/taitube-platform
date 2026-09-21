import { memo } from 'react';

import styles from './user-details.module.scss';

import type { Channel } from '@vp/api-contracts';

import { formatNumbers } from 'src/modules/shared/helpers';

import { ProfilePicture, SubscribeButton } from 'src/modules/shared/components';

export type UserDetailsProps = {
	channel: Channel;
}

export const UserDetails = memo(({ channel }: UserDetailsProps) => {
	return (
		<div className={styles.container}>
			<div>
				<ProfilePicture src={channel.avatarUrl} />
			</div>
			<div className={styles.container__wrapper}>
				<h2 title={channel.displayName}>{channel.displayName}</h2>
				<div className={styles.textWrapper}>
					<span>{formatNumbers(channel.subscriberCount, channel.subscriberCount >= 10000 ? 0 : 1)} subscribers</span>
				</div>
				<SubscribeButton channelId={channel.id} />
			</div>
		</div>
	)
});

export default UserDetails;
