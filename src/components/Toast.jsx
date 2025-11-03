import { useEffect } from 'react';

/**
 * Toast notification component for displaying temporary messages.
 * @param {Object} props
 * @param {string} props.message - Message to display
 * @param {('info'|'error'|'warning'|'success')} props.type - Type of notification
 * @param {Function} props.onClose - Callback when toast is dismissed
 * @param {number} [props.duration=4000] - Duration in ms before auto-dismiss
 */
function Toast({ message, type = 'info', onClose, duration = 4000 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      default: return 'ℹ️';
    }
  };

  return (
    <div className={`toast toast-${type}`}>
      <span className="toast-icon">{getIcon()}</span>
      <span className="toast-message">{message}</span>
      <button 
        type="button" 
        className="toast-close" 
        onClick={onClose}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}

export default Toast;
