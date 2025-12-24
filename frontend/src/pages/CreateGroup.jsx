import { useNavigate } from 'react-router-dom';
import styles from './CreateGroup.module.css';
import CreateGroupForm from '../components/groups/CreateGroupForm';
import Navbar from '../components/common/Navbar';

function CreateGroup() {
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
          <CreateGroupForm />
        </div>
      </div>
    </>
  );
}

export default CreateGroup;

