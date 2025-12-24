import { useNavigate } from 'react-router-dom';
import styles from './SignUp.module.css';
import SignUpForm from '../components/auth/SignUpForm';
import Navbar from '../components/common/Navbar';

function SignUp() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/');
  };

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        <button onClick={handleBack} className={styles.backButton}>
          ← Back
        </button>
        
        <div className={styles.content}>
          <SignUpForm />
        </div>
      </div>
    </>
  );
}

export default SignUp;

