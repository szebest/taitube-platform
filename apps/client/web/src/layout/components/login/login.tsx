import { useRouter } from '@tanstack/react-router';
import { settleSession, signOut, useAccount } from '@vp/queries';
import { Dropdown } from 'react-bootstrap';

import styles from './login.module.scss';

import { STUDIO_URL } from '#app/config';
import { ProfilePicture } from '#app/modules/shared/components';

export function Login() {
  const account = useAccount();
  const router = useRouter();

  if (!account) return null;

  const handleSignOut = async () => {
    await signOut();
    await settleSession(router);
  };

  return (
    <div className={styles.loginWrapper}>
      <div className={styles.loginWrapper__userInfo}>
        <span>{account.channel.displayName}</span>
        <Dropdown className={styles.dropdown}>
          <Dropdown.Toggle as="div" aria-label="settings">
            <ProfilePicture src={account.channel.avatarUrl} />
          </Dropdown.Toggle>

          <Dropdown.Menu>
            <div className={`${styles.dropdown__username} dropdown-item`}>
              <div>
                <span title={account.channel.displayName}>{account.channel.displayName}</span>
              </div>
            </div>

            <Dropdown.Item as="div">
              <a href={`${STUDIO_URL}/upload`}>
                <i className="bi bi-cloud-arrow-up-fill" />
                <span>Upload</span>
              </a>
            </Dropdown.Item>

            <Dropdown.Divider />

            <Dropdown.Item as="div">
              <button
                type="button"
                aria-label="sign out"
                className="btn-initial"
                onClick={handleSignOut}
              >
                <i className="bi bi-door-closed-fill" />
                <span>Sign out</span>
              </button>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </div>
  );
}
