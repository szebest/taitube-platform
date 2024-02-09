import { memo } from "react";
import { useNavigate } from "react-router-dom";

import styles from './video-settings-dropdown.module.scss';

import { Video } from "../../models";

import { Dropdown } from "react-bootstrap";
import { useDeleteVideoMutation } from "../../api";

export type VideoSettingsDropdownProps = {
	video: Omit<Video, 'thumbnailSrc'>;
}

export const VideoSettingsDropdown = memo(({ video }: VideoSettingsDropdownProps) => {
	const navigate = useNavigate();

	const [deleteVideoComment, { isLoading: isDeleteLoading }] = useDeleteVideoMutation();

	const handleEdit = () => {
		navigate(`/upload/edit/${video.id}`);
	}

	const handleDelete = () => {
		deleteVideoComment(video.id);
	}

	return (
		<Dropdown onClick={(e) => e.preventDefault()}>
			<Dropdown.Toggle as='div' aria-label='video actions'>
				<button className={`btn btn-transparent btn-round ${styles.toggle}`}>
					<i className="bi bi-three-dots-vertical"></i>
				</button>
			</Dropdown.Toggle>

			<Dropdown.Menu className={`light`} aria-disabled={isDeleteLoading}>
				<Dropdown.Item as='div'>
					<button className='btn-initial' onClick={handleEdit} disabled={isDeleteLoading}>
						<i className="bi bi-pencil"></i>
						<span>Edit</span>
					</button>
				</Dropdown.Item>

				<Dropdown.Divider></Dropdown.Divider>

				<Dropdown.Item as='div'>
					<button className='btn-initial' onClick={handleDelete} disabled={isDeleteLoading}>
						<i className="bi bi-trash"></i>
						<span>Delete</span>
					</button>
				</Dropdown.Item>
			</Dropdown.Menu>
		</Dropdown>
	);
});

export default VideoSettingsDropdown;
