import Modal from './Modal.jsx';

/**
 * Confirmation dialog for destructive actions.
 * Displays a yes/no prompt within a modal.
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls dialog visibility
 * @param {Function} props.onClose - Callback when dialog closes without confirming
 * @param {Function} props.onConfirm - Callback when user confirms action
 * @param {string} props.title - Dialog title
 * @param {string} props.message - Confirmation message to display
 * @param {string} [props.confirmText='Confirm'] - Text for confirm button
 * @param {string} [props.cancelText='Cancel'] - Text for cancel button
 */
function ConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm',
  cancelText = 'Cancel'
}) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="confirm-message">{message}</p>
      <div className="modal-actions">
        <button 
          type="button" 
          className="button-secondary" 
          onClick={onClose}
        >
          {cancelText}
        </button>
        <button 
          type="button" 
          className="button-danger" 
          onClick={handleConfirm}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
