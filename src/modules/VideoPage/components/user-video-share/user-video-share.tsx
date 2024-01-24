import styles from './user-video-share.module.scss';

import { useShareVideoMutation } from '../../api/videoApiSlice';

import { UserFriend } from 'src/modules/shared/models';

export type UserVideoShareProps = {
	friend: UserFriend;
	videoId: number;
}

export const UserVideoShare = ({ friend, videoId }: UserVideoShareProps) => {
	const [share, { isLoading, isError }] = useShareVideoMutation();

	const handleShare = (userId: number) => {
    share({ videoId, userId });
  }
	
	return (
		<div className={styles.container}>
			<p>{friend.name}</p>
			<button
				className={`btn btn-pill ${isError ? 'btn-danger' : 'btn-primary'}`}
				onClick={() => handleShare(friend.id)}
				disabled={isLoading}
			>
				{isError ? 'Retry' : 'Share'}
			</button>
		</div>
	);
}
