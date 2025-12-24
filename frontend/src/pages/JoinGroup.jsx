import { useNavigate } from 'react-router-dom';
import styles from './JoinGroup.module.css';
import JoinGroupForm from '../components/groups/JoinGroupForm';
import Navbar from '../components/common/Navbar';

function JoinGroup() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/dashboard');
  };

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        <button onClick={handleBack} className={styles.backButton}>
          ← Back
        </button>
        
        <div className={styles.content}>
          <JoinGroupForm />
        </div>
      </div>
    </>
  );
}

export default JoinGroup;

