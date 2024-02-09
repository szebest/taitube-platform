import { Form, Modal } from 'react-bootstrap';

import styles from './share-video.module.scss';

import { useAuth } from 'src/modules/shared/providers';

import { UserFriends } from '../../components';

export type ShareVideoModalProps = {
  onClose: VoidFunction,
  show: boolean,
  videoId: number
}

export const ShareVideoModal = ({ onClose, show, videoId }: ShareVideoModalProps) => {
  const { user } = useAuth();

  return (
    <Modal show={show} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Share video</Modal.Title>
      </Modal.Header>

      <Modal.Body className={styles.body}>
        <div className={styles.body__link}>
          <Form.Control type="text" defaultValue={window.location.href} readOnly />
        </div>

        {user && <UserFriends videoId={videoId} />}
      </Modal.Body>
    </Modal>
  )
}