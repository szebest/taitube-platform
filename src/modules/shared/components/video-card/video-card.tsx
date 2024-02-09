import { memo } from "react";
import { Link, useNavigate } from "react-router-dom";

import styles from './video-card.module.scss';

import { API_BASE_URL } from "src/config";
import { timeAgo } from "src/lib";

import { Video } from "../../models";

import { formatNumbers, mapCategory } from "../../helpers";
import { useAuth } from "../../providers";

import { ProfilePicture, VideoSettingsDropdown } from "..";
import { Dropdown } from "react-bootstrap";
import { useDeleteVideoMutation } from "../../api";

export type VideoCardProps = {
	video: Video;
	zIndex?: number;
}

export const VideoCard = memo(({ video, zIndex }: VideoCardProps) => {
	const { user } = useAuth();
	
	const navigate = useNavigate();

	const [deleteVideoComment, { isLoading: isDeleteLoading }] = useDeleteVideoMutation();
	
	const userProfileRoute = `/user/${video.userId}`;
	const videoRoute = `/watch/${video.id}`;

	const handleEdit = () => {
		navigate(`/upload/edit/${video.id}`);
	}

	const handleDelete = () => {
		deleteVideoComment(video.id);
	}
	
	return (
		<Link style={{ zIndex }} to={videoRoute} className={styles.link}>
			<div className={styles.container}>
				<img className={styles.container__thumb} src={API_BASE_URL + video.thumbnailSrc} loading="lazy" alt="thumbnail" />
				<div className={styles.container__info}>
					<div className={styles.container__main}>
						<Link to={userProfileRoute} className={styles.container__avatar}>
							<ProfilePicture src={video.profilePictureSrc} />
						</Link>
						<div>
							<div className={styles.container__title}>
								<p className={styles.text} title={video.title}>{video.title}</p>
							</div>
							<div className={styles.container__meta}>
								<div className={styles.container__meta__user} title={video.userFullName}>
									<Link to={userProfileRoute}>
										<p>{video.userFullName}</p>
									</Link>
								</div>
								<div className={styles.container__meta__stats}>
									<span className={styles.text}>{formatNumbers(video.views)} views</span>
									<span className={styles.seperator}></span>
									<span className={styles.text}>{timeAgo.format(new Date(video.createdAt))}</span>
								</div>
							</div>
						</div>
						<div>
						{user && video.userId === user.id &&
							<VideoSettingsDropdown video={video} />
						}
						</div>
					</div>
					<div className={styles.container__additional}>
						<p className={styles.text} title={video.description}>{video.description}</p>
						<span className="chip">{mapCategory(video.category)}</span>
					</div>
				</div>
			</div>
		</Link>
	);
});

export default VideoCard;
