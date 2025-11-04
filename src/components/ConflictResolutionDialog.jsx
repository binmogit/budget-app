import Modal from './Modal.jsx';

/**
 * Dialog for resolving data conflicts between localStorage and server.
 * Presents both versions side-by-side and lets user choose which to keep.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether dialog is visible
 * @param {Function} props.onClose - Callback when dialog is closed without action
 * @param {Function} props.onResolve - Callback with resolution choice: 'local' | 'server'
 * @param {Object} props.localData - Local version metadata and preview
 * @param {Object} props.serverData - Server version metadata and preview
 * @param {string} props.accountName - Name of the conflicting account
 */
function ConflictResolutionDialog({
  isOpen,
  onClose,
  onResolve,
  localData,
  serverData,
  accountName,
}) {
  if (!isOpen) return null;

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleString('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Data Conflict Detected">
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          The account <strong>{accountName}</strong> has different data in localStorage and on the server.
          This can happen when you edit offline and the server is later available.
        </p>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
          Choose which version to keep. The other version will be overwritten.
        </p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* Local version */}
        <div style={{
          padding: '1rem',
          border: '2px solid var(--border)',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-surface)',
        }}>
          <h3 style={{ 
            margin: '0 0 0.75rem 0', 
            fontSize: '1rem',
            color: 'var(--text-primary)',
          }}>
            💾 Local Version
          </h3>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Transactions:</strong> {localData?.transactionCount ?? 0}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Last Modified:</strong> {formatDate(localData?.lastModified)}
            </div>
            {localData?.preview && (
              <div style={{ 
                marginTop: '0.75rem',
                padding: '0.5rem',
                backgroundColor: 'var(--bg-elevated)',
                borderRadius: '4px',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                maxHeight: '120px',
                overflow: 'auto',
              }}>
                {localData.preview}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onResolve('local')}
            className="button-primary"
            style={{ width: '100%', marginTop: '1rem' }}
          >
            Keep Local Version
          </button>
        </div>

        {/* Server version */}
        <div style={{
          padding: '1rem',
          border: '2px solid var(--border)',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-surface)',
        }}>
          <h3 style={{ 
            margin: '0 0 0.75rem 0', 
            fontSize: '1rem',
            color: 'var(--text-primary)',
          }}>
            ☁️ Server Version
          </h3>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Transactions:</strong> {serverData?.transactionCount ?? 0}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Last Modified:</strong> {formatDate(serverData?.lastModified)}
            </div>
            {serverData?.preview && (
              <div style={{ 
                marginTop: '0.75rem',
                padding: '0.5rem',
                backgroundColor: 'var(--bg-elevated)',
                borderRadius: '4px',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                maxHeight: '120px',
                overflow: 'auto',
              }}>
                {serverData.preview}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onResolve('server')}
            className="button-primary"
            style={{ width: '100%', marginTop: '1rem' }}
          >
            Keep Server Version
          </button>
        </div>
      </div>

      <div style={{ 
        padding: '0.75rem',
        backgroundColor: 'var(--bg-elevated)',
        borderRadius: '4px',
        marginBottom: '1rem',
      }}>
        <p style={{ 
          margin: 0, 
          fontSize: '0.85rem', 
          color: 'var(--text-secondary)',
        }}>
          💡 <strong>Tip:</strong> Export both versions before choosing if you want to manually merge them later.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          className="button-secondary"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}

export default ConflictResolutionDialog;
