import { Form, Modal } from 'react-bootstrap';

import styles from './share-video.module.scss';

import { useUserFriendsQuery } from 'src/modules/shared/api';

import { LoadingSpinner } from 'src/modules/shared/components';
import { UserVideoShare } from '../../components';

export type ShareVideoModalProps = {
  onClose: () => void,
  show: boolean,
  videoId: number
}

export const ShareVideoModal = ({ onClose, show, videoId }: ShareVideoModalProps) => {
  const { data, isError } = useUserFriendsQuery();

	return (
		<Modal show={show} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Share video</Modal.Title>
      </Modal.Header>

      <Modal.Body className={styles.body}>
        <div className={styles.body__link}>
          <Form.Control type="text" defaultValue={window.location.href} readOnly />
        </div>

        <div className={styles.body__friends}>
          {isError ?
            <div>Could not load user's friends...</div> :
            (
              data ?
                data.map(friend => (
                  <UserVideoShare key={friend.id} friend={friend} videoId={videoId} />
                )) :
                <LoadingSpinner />
            )
          }
        </div>
      </Modal.Body>
    </Modal>
	)
}