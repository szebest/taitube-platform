import { Link } from 'react-router-dom';
import { Dropdown } from 'react-bootstrap';

import styles from './login.module.scss';

import { API_BASE_URL } from 'src/config';
import { useAuth } from 'src/modules/shared/providers';

import { ProfilePicture } from 'src/modules/shared/components';

import fbLogoSecondary from 'src/assets/fb-logo-secondary.png';


export function Login() {
	const { user, isLoading, logout } = useAuth();

	if (isLoading)
		return null;

	return (
		<div className={styles.loginWrapper}>
			{!user
				?
				<form method='GET' action={`${API_BASE_URL}/account/facebook-login`}>
					<button type="submit" className={`${styles.loginWrapper__facebookLogin} btn btn-primary`} aria-label="facebook login">
						<img src={fbLogoSecondary} alt="fb" />
						<span>Login with Facebook</span>
					</button>
				</form>
				:
				<div className={styles.loginWrapper__userInfo}>
					<span>{user.firstName}</span>
					<Dropdown>
						<Dropdown.Toggle>
							<ProfilePicture src={user.profilePictureSrc} />
						</Dropdown.Toggle>

						<Dropdown.Menu className={`${styles.dropdown} light`}>
							<div className={`${styles.dropdown__username} dropdown-item`}>
								<div>
									<span>{user.firstName}</span>
								</div>
								<Dropdown.Divider></Dropdown.Divider>
							</div>
							
							<Dropdown.Item>
								<div>
									<i className="bi bi-cloud-arrow-up-fill"></i>
									<Link to='/upload'>Upload</Link>
								</div>
							</Dropdown.Item>

							<Dropdown.Divider></Dropdown.Divider>

							{/* TODO Logout */}
							<Dropdown.Item onClick={logout}>
								<div>
									<i className="bi bi-door-closed-fill"></i>
									<span>Logout</span>
								</div>
							</Dropdown.Item>
						</Dropdown.Menu>
					</Dropdown>
				</div>
			}
		</div>
	);
}

export default Login;