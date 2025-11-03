import { useState } from 'react';
import Modal from './Modal.jsx';

/**
 * Input dialog for collecting single text values from user.
 * Displays a text input field with submit/cancel actions.
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls dialog visibility
 * @param {Function} props.onClose - Callback when dialog closes without submitting
 * @param {Function} props.onSubmit - Callback with input value when user submits
 * @param {string} props.title - Dialog title
 * @param {string} props.label - Label for input field
 * @param {string} [props.placeholder=''] - Input placeholder text
 * @param {string} [props.submitText='Submit'] - Text for submit button
 * @param {string} [props.cancelText='Cancel'] - Text for cancel button
 */
function InputDialog({ 
  isOpen, 
  onClose, 
  onSubmit, 
  title, 
  label,
  placeholder = '',
  submitText = 'Submit',
  cancelText = 'Cancel'
}) {
  const [value, setValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setValue('');
      onClose();
    }
  };

  const handleClose = () => {
    setValue('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="dialog-input" className="form-label">{label}</label>
          <input
            id="dialog-input"
            type="text"
            className="form-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button 
            type="button" 
            className="button-secondary" 
            onClick={handleClose}
          >
            {cancelText}
          </button>
          <button 
            type="submit" 
            className="button-primary"
            disabled={!value.trim()}
          >
            {submitText}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default InputDialog;
