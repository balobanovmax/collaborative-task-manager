import { useNavigate } from 'react-router-dom';
import styles from './SignUp.module.css';
import SignUpForm from '../components/auth/SignUpForm';
import Button from '../components/common/Button';

function SignUp() {
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
        <SignUpForm />
      </div>
    </div>
  );
}

export default SignUp;

