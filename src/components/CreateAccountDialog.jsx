import { useState } from 'react';
import Modal from './Modal.jsx';

/**
 * Dialog for creating a new account with storage location choice.
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls dialog visibility
 * @param {Function} props.onClose - Callback when dialog closes without submitting
 * @param {Function} props.onSubmit - Callback with (accountName, storageType) when user submits
 * @param {boolean} props.serverOnline - Whether server is available
 */
function CreateAccountDialog({ 
  isOpen, 
  onClose, 
  onSubmit,
  serverOnline
}) {
  const [accountName, setAccountName] = useState('');
  const [storageType, setStorageType] = useState('localStorage');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = accountName.trim();
    if (trimmed) {
      onSubmit(trimmed, storageType);
      setAccountName('');
      setStorageType('localStorage');
      onClose();
    }
  };

  const handleClose = () => {
    setAccountName('');
    setStorageType('localStorage');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Account">
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="account-name" className="form-label">Account Name</label>
          <input
            id="account-name"
            type="text"
            className="form-input"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="e.g., ING, NAB, Cash"
            autoFocus
          />
        </div>
        
        <div className="form-field" style={{ marginTop: '1rem' }}>
          <label className="form-label">Storage Location</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="storage"
                value="localStorage"
                checked={storageType === 'localStorage'}
                onChange={(e) => setStorageType(e.target.value)}
              />
              <span>
                <strong>💾 Browser Storage</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                  (localStorage - device-specific)
                </span>
              </span>
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: serverOnline ? 'pointer' : 'not-allowed', opacity: serverOnline ? 1 : 0.5 }}>
              <input
                type="radio"
                name="storage"
                value="server"
                checked={storageType === 'server'}
                onChange={(e) => setStorageType(e.target.value)}
                disabled={!serverOnline}
              />
              <span>
                <strong>☁️ Server Storage</strong>
                <span style={{ fontSize: '0.85rem', color: serverOnline ? 'var(--text-secondary)' : '#f87171', marginLeft: '8px' }}>
                  {serverOnline ? '(persists across devices)' : '(server offline)'}
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
          <button 
            type="button" 
            className="button-secondary" 
            onClick={handleClose}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="button-primary"
            disabled={!accountName.trim()}
          >
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default CreateAccountDialog;
