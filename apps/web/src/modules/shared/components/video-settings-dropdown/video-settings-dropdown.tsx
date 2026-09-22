import { memo } from "react";
import { Dropdown } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import styles from './video-settings-dropdown.module.scss';

import type { VideoSummary } from "@vp/api-contracts";

import { useDeleteVideoMutation } from "../../api";

export type VideoSettingsDropdownProps = {
	video: Pick<VideoSummary, 'id'>;
	shouldRedirectOnDelete?: boolean;
}

export const VideoSettingsDropdown = memo(({ video, shouldRedirectOnDelete }: VideoSettingsDropdownProps) => {
	const navigate = useNavigate();

	const [deleteVideo, { isLoading: isDeleteLoading }] = useDeleteVideoMutation();

	const handleEdit = () => {
		navigate(`/upload/edit/${video.id}`);
	}

	const handleDelete = async () => {
		const result = await deleteVideo(video.id);

		if ("data" in result) {
			toast('Successfully deleted the video');

			if (shouldRedirectOnDelete) {
				navigate(-1);
			}
		}
	}

	return (
		<Dropdown onClick={(e) => e.preventDefault()}>
			<Dropdown.Toggle as='div' aria-label='video actions'>
				<button type="button" className={`btn btn-transparent btn-round ${styles.toggle}`}>
					<i className="bi bi-three-dots-vertical" />
				</button>
			</Dropdown.Toggle>

			<Dropdown.Menu className={'light'} aria-disabled={isDeleteLoading}>
				<Dropdown.Item as='div'>
					<button type="button" className='btn-initial' onClick={handleEdit} disabled={isDeleteLoading}>
						<i className="bi bi-pencil" />
						<span>Edit</span>
					</button>
				</Dropdown.Item>

				<Dropdown.Divider />

				<Dropdown.Item as='div'>
					<button type="button" className='btn-initial' onClick={handleDelete} disabled={isDeleteLoading}>
						<i className="bi bi-trash" />
						<span>Delete</span>
					</button>
				</Dropdown.Item>
			</Dropdown.Menu>
		</Dropdown>
	);
});

export default VideoSettingsDropdown;
