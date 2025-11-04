import { useState } from 'react';
import { saveTransactions } from '../utils/transactionStorage.js';
import { saveAccountToServer } from '../utils/serverApi.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import Toast from './Toast.jsx';

/**
 * Transaction viewer and editor component.
 * Displays transaction data in a table with inline editing capabilities.
 * 
 * @param {Object} props
 * @param {Object|null} props.selectedAccount - Currently selected account object
 * @param {Object} props.tableData - Table data with headers and rows
 * @param {string} props.status - Current status ('idle', 'loading', 'ready', 'error')
 * @param {string|null} props.error - Error message if status is 'error'
 * @param {Function} props.onTableDataChange - Callback when table data changes after save
 * @param {Function} props.onRefresh - Callback to trigger refresh after save
 */
function TransactionViewer({
  selectedAccount,
  tableData,
  status,
  error,
  onTableDataChange,
  onRefresh,
}) {
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedData, setEditedData] = useState({ headers: [], rows: [] });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  // Enter edit mode
  const handleEnterEditMode = () => {
    if (!selectedAccount) {
      showToast('No account selected.', 'warning');
      return;
    }
    
    setIsEditMode(true);
    setEditedData({ ...tableData });
    setHasUnsavedChanges(false);
  };

  // Exit edit mode without saving
  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      setShowDiscardDialog(true);
      return;
    }
    
    setIsEditMode(false);
    setEditedData({ headers: [], rows: [] });
    setHasUnsavedChanges(false);
  };

  // Confirm discarding changes
  const confirmDiscardChanges = () => {
    setIsEditMode(false);
    setEditedData({ headers: [], rows: [] });
    setHasUnsavedChanges(false);
    setShowDiscardDialog(false);
  };

  // Update a cell value
  const handleCellChange = (rowIndex, columnIndex, value) => {
    const newRows = [...editedData.rows];
    newRows[rowIndex] = [...newRows[rowIndex]];
    newRows[rowIndex][columnIndex] = value;
    
    setEditedData({ ...editedData, rows: newRows });
    setHasUnsavedChanges(true);
  };

  // Save changes back to storage
  const handleSaveChanges = async () => {
    if (!selectedAccount) return;

    try {
      // Convert edited CSV rows back to transaction objects
      const headers = editedData.headers;
      const transactions = editedData.rows.map(row => {
        const transaction = {};
        headers.forEach((header, index) => {
          transaction[header] = row[index] ?? '';
        });
        return transaction;
      });

      // Validate required fields
      const requiredFields = ['Date', 'TransactionID', 'Description', 'Category', 'Amount'];
      for (const transaction of transactions) {
        for (const field of requiredFields) {
          if (!transaction[field] || transaction[field].toString().trim() === '') {
            showToast(`Validation error: ${field} is required in all rows`, 'error');
            return;
          }
        }
      }

      // Save to localStorage
      const success = saveTransactions(selectedAccount.accountName, transactions);
      
      if (!success) {
        showToast('Failed to save changes to localStorage', 'error');
        return;
      }

      // If it's a server account, also save to server
      if (selectedAccount.source === 'server') {
        try {
          await saveAccountToServer(selectedAccount.accountName, transactions);
        } catch (error) {
          showToast(`Saved to localStorage but failed to sync to server: ${error.message}`, 'warning');
        }
      }

      // Update the table data and exit edit mode
      onTableDataChange({ ...editedData });
      setIsEditMode(false);
      setHasUnsavedChanges(false);
      onRefresh(); // Refresh file list to update sizes
      
      showToast('Changes saved successfully', 'success');
    } catch (error) {
      showToast(`Failed to save changes: ${error.message}`, 'error');
    }
  };

  // Add a new empty row
  const handleAddRow = () => {
    const newRow = editedData.headers.map(() => '');
    setEditedData({
      ...editedData,
      rows: [...editedData.rows, newRow]
    });
    setHasUnsavedChanges(true);
  };

  // Delete a row
  const handleDeleteRow = (rowIndex) => {
    const newRows = editedData.rows.filter((_, index) => index !== rowIndex);
    setEditedData({
      ...editedData,
      rows: newRows
    });
    setHasUnsavedChanges(true);
  };

  return (
    <>
      <ConfirmDialog
        isOpen={showDiscardDialog}
        onClose={() => setShowDiscardDialog(false)}
        onConfirm={confirmDiscardChanges}
        title="Discard Changes"
        message="You have unsaved changes. Are you sure you want to discard them?"
        confirmText="Discard"
      />

      <div className="preview-pane">
        {selectedAccount && status === 'ready' && (
          <div className="file-metadata">
            <div className="metadata-row">
              <span className="metadata-label">Source:</span>
              <span className="metadata-value">
                {selectedAccount.source === 'localStorage' && '💾 localStorage'}
                {selectedAccount.source === 'server' && '☁️ Server'}
              </span>
            </div>

            {selectedAccount.transactionCount != null && (
              <div className="metadata-row">
                <span className="metadata-label">Transactions:</span>
                <span className="metadata-value">
                  {selectedAccount.transactionCount}
                </span>
              </div>
            )}

            {selectedAccount.size && (
              <div className="metadata-row">
                <span className="metadata-label">Size:</span>
                <span className="metadata-value">{selectedAccount.size}</span>
              </div>
            )}

            {selectedAccount.source === 'localStorage' && (
              <div className="metadata-warning">⚠️ Data stored in browser localStorage. Export regularly to avoid data loss.</div>
            )}

            {selectedAccount.source === 'server' && (
              <div className="metadata-note">☁️ This account is stored on the configured server.</div>
            )}
          </div>
        )}
        {status === 'idle' && <div className="placeholder">Select an account to preview its transactions.</div>}
        {status === 'loading' && <div className="placeholder">Loading account…</div>}
        {status === 'error' && <div className="error-message">{error}</div>}
        {status === 'ready' && tableData.headers.length > 0 && (
          <>
            {/* Edit mode toolbar */}
            {selectedAccount && (
              <div className="edit-toolbar">
                {!isEditMode ? (
                  <button
                    type="button"
                    onClick={handleEnterEditMode}
                    className="button-secondary"
                  >
                    Edit Transactions
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="button-secondary"
                    >
                      Add Row
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveChanges}
                      className="button-primary"
                      disabled={!hasUnsavedChanges}
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="button-secondary"
                    >
                      Cancel
                    </button>
                    {hasUnsavedChanges && (
                      <span style={{ color: 'var(--accent)', fontSize: '0.9rem', marginLeft: '8px' }}>
                        ● Unsaved changes
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
            
            <div className="table-container">
              <table className="csv-table">
                <thead>
                  <tr>
                    {isEditMode && <th style={{ width: '60px' }}>Actions</th>}
                    {(isEditMode ? editedData.headers : tableData.headers).map((header, index) => (
                      <th key={`${header}-${index}`}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(isEditMode ? editedData.rows : tableData.rows).map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`}>
                      {isEditMode && (
                        <td>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(rowIndex)}
                            className="button-danger"
                            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                            title="Delete row"
                          >
                            ✕
                          </button>
                        </td>
                      )}
                      {(isEditMode ? editedData.headers : tableData.headers).map((_, columnIndex) => (
                        <td key={`cell-${rowIndex}-${columnIndex}`}>
                          {isEditMode ? (
                            <input
                              type="text"
                              value={row[columnIndex] ?? ''}
                              onChange={(e) => handleCellChange(rowIndex, columnIndex, e.target.value)}
                              className="cell-input"
                            />
                          ) : (
                            row[columnIndex] ?? ''
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {status === 'ready' && tableData.headers.length === 0 && (
          <div className="placeholder">This account has no transactions to display.</div>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

export default TransactionViewer;
