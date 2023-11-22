import styles from './login.module.scss';

import { useAuth } from '../../providers';

import { API_BASE_URL } from 'src/config';


export function Login() {
  const { user } = useAuth();

  return (
    <div className={styles.loginWrapper}>
      {user === null &&
        <form method='GET' action={`${API_BASE_URL}/account/facebook-login`}>
          <button type="submit" className={styles.loginWrapper__facebookLogin}>
            Login with Facebook
          </button>
        </form>
      }
      {user !== null &&
        <button onClick={() => console.log('clicked')} className={styles.loginWrapper__profile}>
        </button>
      }
    </div>
  );
}

export default Login;