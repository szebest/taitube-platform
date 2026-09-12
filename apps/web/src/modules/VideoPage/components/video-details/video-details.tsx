import { useState } from 'react';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import styles from './video-details.module.scss';

import { useVideoDetailsQuery } from '../../api/videoApiSlice';

import { formatNumbers } from 'src/modules/shared/helpers';

import { LoadingSpinner, ProfilePicture, SubscribeButton, VideoSettingsDropdown } from 'src/modules/shared/components';

import { VideoDescription, VideoLikes } from '..';
import { ShareVideoModal } from '../../modals';

export type VideoDetailsProps = {
	videoId: number;
}

export const VideoDetails = ({ videoId }: VideoDetailsProps) => {
	const [isShareModalOpen, setIsShareModalOpen] = useState(false);
	const { data, isLoading } = useVideoDetailsQuery({ videoId });

	if (isLoading) return <LoadingSpinner />
	if (!data) return null;

	const handleShare = () => {
		setIsShareModalOpen(true);
	}

	const handleCloseShareModal = () => {
		setIsShareModalOpen(false);
	}

	const userProfileRoute = `/user/${data.userId}`;

	return (
		<>
			<div className={styles.container}>
				<div className={styles.top}>
					<h4 className={styles.title} title={data.title}>{data.title}</h4>
					<VideoSettingsDropdown video={data} shouldRedirectOnDelete />
				</div>
				<div className={styles.wrapper}>
					<div className={styles.left}>
						<div className={styles.profile}>
							<Link to={userProfileRoute}>
								<ProfilePicture src={data.profilePictureSrc} />
							</Link>
							<div>
								<div className={styles.username} title={data.userFullName}><Link to={userProfileRoute}>{data.userFullName}</Link></div>
								<div className={styles.subscriptions}>{formatNumbers(data.subscriptions, data.subscriptions >= 10000 ? 0 : 1)} subscribers</div>
							</div>
						</div>

						<div className={styles.subscribeBtn}>
							<SubscribeButton {...data} videoId={videoId} />
						</div>
					</div>

					<div className={styles.right}>
						<VideoLikes data={data} videoId={videoId} />

						<Button className="btn-light btn-lg btn-pill" onClick={handleShare}>Share</Button>
					</div>
				</div>
				<VideoDescription data={data} />
			</div>

			<ShareVideoModal onClose={handleCloseShareModal} show={isShareModalOpen} videoId={videoId} />
		</>
	)
};

export default VideoDetails;