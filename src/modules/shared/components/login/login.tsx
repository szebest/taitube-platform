import styles from './login.module.scss';

import { useAuth } from '../../providers';

import { API_BASE_URL } from 'src/config';


export function Login() {
  const { user } = useAuth();

  return (
    <div className={styles.loginWrapper}>
      {!user 
        ?
        <form method='GET' action={`${API_BASE_URL}/account/facebook-login`}>
          <button type="submit" className={styles.loginWrapper__facebookLogin}>
            Login with Facebook
          </button>
        </form>
        :
        <div className={styles.loginWrapper__userInfo}>
          <span>{user.firstName}</span>
          <img src={user.profilePictureSrc} alt="profile"></img>
        </div>
      }
    </div>
  );
}

export default Login;