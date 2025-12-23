import { useNavigate } from 'react-router-dom';
import styles from './Login.module.css';
import LoginForm from '../components/auth/LoginForm';
import Button from '../components/common/Button';

function Login() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className={styles.container}>
      <div className={styles.backButtonContainer}>
        <Button variant="secondary" onClick={handleBack}>
          ← Back
        </Button>
      </div>
      
      <div className={styles.content}>
        <LoginForm />
      </div>
    </div>
  );
}

export default Login;

