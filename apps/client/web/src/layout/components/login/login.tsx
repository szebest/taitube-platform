import { Link } from '@tanstack/react-router';
import { Dropdown } from 'react-bootstrap';

import styles from './login.module.scss';

import { clearAuthToken } from '#app/auth-token';
import { useAuth } from '#app/modules/shared/providers';

import { ProfilePicture } from '#app/modules/shared/components';

export function Login() {
	const { account, isLoading } = useAuth();

	if (isLoading || !account) return null;

	const handleSignOut = () => {
		clearAuthToken();
		window.location.assign('/');
	};

	return (
		<div className={styles.loginWrapper}>
			<div className={styles.loginWrapper__userInfo}>
				<span>{account.channel.displayName}</span>
				<Dropdown className={styles.dropdown}>
					<Dropdown.Toggle as='div' aria-label="settings">
						<ProfilePicture src={account.channel.avatarUrl} />
					</Dropdown.Toggle>

					<Dropdown.Menu>
						<div className={`${styles.dropdown__username} dropdown-item`}>
							<div>
								<span title={account.channel.displayName}>{account.channel.displayName}</span>
							</div>
						</div>

						<Dropdown.Item as='div'>
							<Link to='/upload'>
								<i className="bi bi-cloud-arrow-up-fill" />
								<span>Upload</span>
							</Link>
						</Dropdown.Item>

						<Dropdown.Divider />

						<Dropdown.Item as='div'>
							<button type="button" aria-label="sign out" className='btn-initial' onClick={handleSignOut}>
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
