import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import styles from './video-details.module.scss';

import { useVideoDetailsQuery } from '../../api/videoApiSlice';

import { formatNumbers } from 'src/modules/shared/helpers';

import { LoadingSpinner } from 'src/modules/shared/components';
import { VideoDescription, VideoLikes } from '..';

export type VideoDetailsProps = {
	videoId: number;
}

export const VideoDetails = ({ videoId }: VideoDetailsProps) => {
	const { data, isLoading } = useVideoDetailsQuery(videoId);

	if (isLoading) return <LoadingSpinner />
	if (!data) return null;

	const handleSubscribe = () => {
		//TODO
	}

	const handleShare = () => {
		//TODO
	}

  return (
    <div className={styles.container}>
			<h4 className={styles.title}>{data.title}</h4>
			<div className={styles.wrapper}>
				<div className={styles.left}>
					<div>
						<div className={styles.username}><Link to={`/profile/${data.id}`}>{data.userFullName}</Link></div>
						<div className={styles.subscriptions}>{formatNumbers(data.subscriptions, data.subscriptions >= 10000 ? 0 : 1)} subscribers</div>
					</div>

					<Button className={`${data.isSubscribed ? 'btn-light' : 'btn-dark'} btn-lg btn-pill`} onClick={handleSubscribe}>{data.isSubscribed ? 'Unsubscribe' : 'Subscribe'}</Button>
				</div>

				<div className={styles.right}>
					<VideoLikes data={data} videoId={videoId} />

					<Button className="btn-light btn-lg btn-pill" onClick={handleShare}>Share</Button>
				</div>
			</div>
			<VideoDescription data={data} />
		</div>
  )
};

export default VideoDetails;