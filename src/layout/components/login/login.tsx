import { Link } from 'react-router-dom';
import { Dropdown } from 'react-bootstrap';

import styles from './login.module.scss';

import { API_BASE_URL } from 'src/config';
import { useAuth } from 'src/modules/shared/providers';

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
          <button type="submit" className={`${styles.loginWrapper__facebookLogin} btn btn-primary`}>
            <img src={fbLogoSecondary} alt="fb" />
            <span>Login with Facebook</span>
          </button>
        </form>
        :
        <div className={styles.loginWrapper__userInfo}>
          <span>{user.firstName}</span>
          <Dropdown>
            <Dropdown.Toggle>
              <img src={user.profilePictureSrc} alt="profile" />
            </Dropdown.Toggle>

            <Dropdown.Menu className='light'>
              <Dropdown.Item>
                <Link to='/upload'>Upload</Link>
              </Dropdown.Item>

              <Dropdown.Divider></Dropdown.Divider>

              {/* TODO Logout */}
              <Dropdown.Item onClick={logout}>
                <span>Logout</span>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      }
    </div>
  );
}

export default Login;