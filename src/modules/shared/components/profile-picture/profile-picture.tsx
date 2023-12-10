import { SyntheticEvent, memo } from 'react';

import styles from './profile-picture.module.scss';

export type ProfilePictureProps = {
	src: string | undefined | null;
}

export const ProfilePicture = memo(({ src }: ProfilePictureProps) => {
	return (
		<div className={styles["profile-picture-img-wrapper"]}>
			{src &&
				<img
				className={styles["profile-picture-img"]}
					src={src}
					alt="profile"
					onError={(e: SyntheticEvent) => (e.target as HTMLImageElement).style.display = 'none'}
				/>
			}
		</div>
	);
});

export default ProfilePicture;