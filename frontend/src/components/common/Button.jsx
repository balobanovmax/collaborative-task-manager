import styles from './Button.module.css';

function Button({ children, variant = 'primary', onClick, type = 'button', disabled = false }) {
  const buttonClass = variant === 'primary' 
    ? styles.btnPrimary 
    : variant === 'secondary'
    ? styles.btnSecondary
    : variant === 'danger'
    ? styles.btnDanger
    : styles.btnSuccess;

  return (
    <button 
      className={buttonClass}
      onClick={onClick}
      type={type}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default Button;

