import styles from "./user-friends.module.scss";

import { useUserFriendsQuery } from "src/modules/shared/api";

import { LoadingSpinner } from "src/modules/shared/components";
import { UserVideoShare } from "..";

export type UserFriendsProps = {
	videoId: number;
};

export const UserFriends = ({ videoId }: UserFriendsProps) => {
	const { data, isError } = useUserFriendsQuery();
	
	return (
		<div className={styles.container}>
			{isError ? (
				<div>Could not load user's friends...</div>
			) : data ? (
				data.map((friend) => (
					<UserVideoShare key={friend.id} friend={friend} videoId={videoId} />
				))
			) : (
				<LoadingSpinner />
			)}
		</div>
	);
};
