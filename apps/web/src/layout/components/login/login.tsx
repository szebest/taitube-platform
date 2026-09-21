import { Link } from 'react-router-dom';
import { Dropdown } from 'react-bootstrap';

import styles from './login.module.scss';

import { clearAuthToken } from 'src/auth-token';
import { useAuth } from 'src/modules/shared/providers';

import { ProfilePicture } from 'src/modules/shared/components';

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
								<i className="bi bi-cloud-arrow-up-fill"></i>
								<span>Upload</span>
							</Link>
						</Dropdown.Item>

						<Dropdown.Divider></Dropdown.Divider>

						<Dropdown.Item as='div'>
							<button type="button" aria-label="sign out" className='btn-initial' onClick={handleSignOut}>
								<i className="bi bi-door-closed-fill"></i>
								<span>Sign out</span>
							</button>
						</Dropdown.Item>
					</Dropdown.Menu>
				</Dropdown>
			</div>
		</div>
	);
}

export default Login;
