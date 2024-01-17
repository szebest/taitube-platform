import { memo } from 'react';

import styles from './user-details.module.scss';

import { formatNumbers } from 'src/modules/shared/helpers';

import {  ProfilePicture, SubscribeButton } from 'src/modules/shared/components';

import { UserDetails as UserDetailsModel } from '../../models';

export type UserDetailsProps = {
	details: UserDetailsModel;
	userId: number;
	videosCount?: number;
}

export const UserDetails = memo(({ details, userId, videosCount }: UserDetailsProps) => {
	return (
		<div className={styles.container}>
			<div>
				<ProfilePicture src={details.profilePictureSrc} />
			</div>
			<div className={styles.container__wrapper}>
				<h2 title={details.userFullName}>{details.userFullName}</h2>
				<div className={styles.textWrapper}>
					<span>{formatNumbers(details.subscriptions, details.subscriptions >= 10000 ? 0 : 1)} subscribers</span>
					<span> • </span>
					<span>{videosCount} videos</span>
				</div>
				<SubscribeButton {...details} userId={userId} />
			</div>
		</div>
	)
});

export default UserDetails;