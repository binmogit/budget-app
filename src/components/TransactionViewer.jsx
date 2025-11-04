import { useState } from 'react';
import { saveTransactions, getAccountMetadata, markAsSynced, markAsUnsynced } from '../utils/transactionStorage.js';
import { saveAccountToServer, fetchAccountMetadata, fetchAccountTransactions } from '../utils/serverApi.js';
import { refreshSheetData } from '../utils/sheetsApi.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import ConflictResolutionDialog from './ConflictResolutionDialog.jsx';
import Toast from './Toast.jsx';
import { transactionsToCSV } from '../utils/transactionStorage.js';

/**
 * Transaction viewer and editor component.
 * Displays transaction data in a table with inline editing capabilities.
 * 
 * @param {Object} props
 * @param {Object|null} props.selectedAccount - Currently selected account object
 * @param {Object} props.tableData - Table data with headers and rows
 * @param {string} props.status - Current status ('idle', 'loading', 'ready', 'error')
 * @param {string|null} props.error - Error message if status is 'error'
 * @param {boolean} props.serverOnline - Whether the server is currently online
 * @param {Function} props.onTableDataChange - Callback when table data changes after save
 * @param {Function} props.onRefresh - Callback to trigger refresh after save
 */
function TransactionViewer({
  selectedAccount,
  tableData,
  status,
  error,
  serverOnline,
  onTableDataChange,
  onRefresh,
}) {
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedData, setEditedData] = useState({ headers: [], rows: [] });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Conflict resolution state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictData, setConflictData] = useState(null);
  const [pendingSaveData, setPendingSaveData] = useState(null);

  // Toast notification state
  const [toast, setToast] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  // Refresh Google Sheets data
  const handleRefreshSheet = async () => {
    if (!selectedAccount || selectedAccount.source !== 'googleSheet') return;

    const metadata = getAccountMetadata(selectedAccount.accountName);
    if (!metadata || !metadata.googleSheetId || !metadata.sheetName) {
      showToast('Missing Google Sheets connection info', 'error');
      return;
    }

    setIsRefreshing(true);
    try {
      const transactions = await refreshSheetData(metadata.googleSheetId, metadata.sheetName);
      
      // Save refreshed data to localStorage cache
      saveTransactions(selectedAccount.accountName, transactions, {
        googleSheetId: metadata.googleSheetId,
        sheetName: metadata.sheetName,
        lastSync: Date.now(),
      });

      showToast('Sheet data refreshed successfully', 'success');
      onRefresh(); // Trigger parent refresh to reload data
    } catch (error) {
      showToast(`Failed to refresh sheet: ${error.message}`, 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Enter edit mode
  const handleEnterEditMode = () => {
    if (!selectedAccount) {
      showToast('No account selected.', 'warning');
      return;
    }

    // Prevent editing Google Sheets accounts
    if (selectedAccount.source === 'googleSheet') {
      showToast('Google Sheets accounts are read-only. Make changes in the Google Sheet and click Refresh.', 'warning');
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

      // If it's a server account, check for conflicts before saving
      if (selectedAccount.source === 'server') {
        try {
          // Fetch server metadata to check if it's been modified since we loaded it
          const serverMetadata = await fetchAccountMetadata(selectedAccount.accountName);
          const localMetadata = getAccountMetadata(selectedAccount.accountName);
          
          // Check if both versions exist and have been modified
          if (serverMetadata && localMetadata) {
            // If server was modified more recently than local, there's a conflict
            if (serverMetadata.lastModified > localMetadata.lastModified) {
              // Fetch full server data for comparison
              const serverTransactions = await fetchAccountTransactions(selectedAccount.accountName);
              
              // Prepare conflict dialog data
              const localPreview = transactions.slice(0, 3).map(tx => 
                `${tx.Date} | ${tx.Description} | ${tx.Amount}`
              ).join('\n') + (transactions.length > 3 ? '\n...' : '');
              
              const serverPreview = serverTransactions.slice(0, 3).map(tx => 
                `${tx.Date} | ${tx.Description} | ${tx.Amount}`
              ).join('\n') + (serverTransactions.length > 3 ? '\n...' : '');
              
              setConflictData({
                local: {
                  transactionCount: transactions.length,
                  lastModified: localMetadata.lastModified,
                  preview: localPreview,
                },
                server: {
                  transactionCount: serverTransactions.length,
                  lastModified: serverMetadata.lastModified,
                  preview: serverPreview,
                },
              });
              
              // Store the pending save data for when user resolves conflict
              setPendingSaveData(transactions);
              setShowConflictDialog(true);
              return; // Don't save yet - wait for user to resolve conflict
            }
          }
        } catch (error) {
          console.warn('Failed to check for conflicts, proceeding with save:', error);
        }
      }

      // No conflict detected, proceed with normal save
      await performSave(transactions);
      
    } catch (error) {
      showToast(`Failed to save changes: ${error.message}`, 'error');
    }
  };

  // Handle conflict resolution choice
  const handleConflictResolution = async (choice) => {
    setShowConflictDialog(false);
    
    try {
      if (choice === 'local') {
        // User wants to keep local version - overwrite server
        await performSave(pendingSaveData);
        // performSave already handles marking as synced
      } else if (choice === 'server') {
        // User wants to keep server version - discard local changes
        const serverTransactions = await fetchAccountTransactions(selectedAccount.accountName);
        
        // Update localStorage with server data and mark as synced
        saveTransactions(selectedAccount.accountName, serverTransactions, { syncedToServer: true });
        
        // Update UI
        const csvText = transactionsToCSV(serverTransactions);
        const headers = csvText.split('\n')[0].split(',');
        const rows = csvText.split('\n').slice(1).filter(row => row.trim()).map(row => row.split(','));
        
        onTableDataChange({ headers, rows });
        setIsEditMode(false);
        setHasUnsavedChanges(false);
        onRefresh();
        
        showToast('Server version loaded and saved locally', 'success');
      }
    } catch (error) {
      showToast(`Failed to resolve conflict: ${error.message}`, 'error');
    } finally {
      setPendingSaveData(null);
      setConflictData(null);
    }
  };

  // Perform the actual save operation (separated for reuse)
  const performSave = async (transactions) => {
    const isServerAccount = selectedAccount.source === 'server' || 
                           selectedAccount.source === 'serverOffline' || 
                           selectedAccount.source === 'conflict';
    
    // Save to localStorage (mark as unsynced for now if it's a server account)
    const success = saveTransactions(selectedAccount.accountName, transactions, {
      syncedToServer: false, // Mark as unsynced until server save succeeds
    });
    
    if (!success) {
      showToast('Failed to save changes to localStorage', 'error');
      return;
    }

    // If it's a server account, also save to server
    if (isServerAccount) {
      try {
        await saveAccountToServer(selectedAccount.accountName, transactions);
        markAsSynced(selectedAccount.accountName); // Mark as synced after successful server save
        showToast('Changes saved successfully', 'success');
      } catch (error) {
        markAsUnsynced(selectedAccount.accountName); // Ensure marked as unsynced if server save failed
        showToast(`Saved to localStorage but failed to sync to server: ${error.message}`, 'warning');
      }
    } else {
      showToast('Changes saved successfully', 'success');
    }

    // Update the table data and exit edit mode
    onTableDataChange({ ...editedData });
    setIsEditMode(false);
    setHasUnsavedChanges(false);
    onRefresh(); // Refresh file list to update sizes and badges
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

      <ConflictResolutionDialog
        isOpen={showConflictDialog}
        onClose={() => {
          setShowConflictDialog(false);
          setPendingSaveData(null);
          setConflictData(null);
        }}
        onResolve={handleConflictResolution}
        localData={conflictData?.local}
        serverData={conflictData?.server}
        accountName={selectedAccount?.accountName}
      />

      <div className="preview-pane">
        {selectedAccount && status === 'ready' && (
          <div className="file-metadata">
            <div className="metadata-row">
              <span className="metadata-label">Source:</span>
              <span className="metadata-value">
                {selectedAccount.source === 'localStorage' && '💾 localStorage'}
                {selectedAccount.source === 'server' && '☁️ Server'}
                {selectedAccount.source === 'serverOffline' && '⛈️ Server (Offline)'}
                {selectedAccount.source === 'conflict' && '⚠️ Unsaved Changes'}
                {selectedAccount.source === 'googleSheet' && '📊 Google Sheets (Read-Only)'}
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

            {selectedAccount.source === 'serverOffline' && (
              <>
                <div className="metadata-warning">⚠️ Data stored in browser localStorage. Export regularly to avoid data loss.</div>
                <div className="metadata-warning">⚠️ Server is offline. You can sync changes when server is available.</div>
              </>
            )}

            {selectedAccount.source === 'conflict' && (
              <>
                <div className="metadata-warning">⚠️ Data stored in browser localStorage. Export regularly to avoid data loss.</div>
                {serverOnline ? (
                  <div className="metadata-warning">⚠️ This account has unsaved local changes that need to be synced to the server.</div>
                ) : (
                  <div className="metadata-warning">⚠️ Server is offline. You can sync changes when server is available.</div>
                )}
              </>
            )}

            {selectedAccount.source === 'googleSheet' && (
              <>
                <div className="metadata-note">📊 Live Google Sheets connection - data is read-only in this view</div>
                <div className="metadata-note">
                  Last synced: {selectedAccount.lastSync ? new Date(selectedAccount.lastSync).toLocaleString() : 'Never'}.
                  Click &quot;Refresh&quot; to fetch latest data from sheet.
                </div>
              </>
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
                {selectedAccount.source === 'googleSheet' ? (
                  <button
                    type="button"
                    onClick={handleRefreshSheet}
                    className="button-primary"
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? 'Refreshing...' : 'Refresh from Sheet'}
                  </button>
                ) : !isEditMode ? (
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
