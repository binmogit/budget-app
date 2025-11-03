import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { getTransactions, listAccounts, transactionsToCSV, saveTransactions, deleteAccount, renameAccount } from '../utils/transactionStorage.js';
import { checkServerHealth, fetchAccounts, saveAccountToServer, deleteAccountFromServer } from '../utils/serverApi.js';
import CreateAccountDialog from './CreateAccountDialog.jsx';
import InputDialog from './InputDialog.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

const csvModules = import.meta.glob('../data/**/*.csv', { as: 'url', eager: true });

/**
 * Formats a byte count into a human-readable file size string.
 * @param {string|null} contentLengthHeader - Content-Length header value from fetch response
 * @param {number} fallbackLength - Fallback byte count if header is missing
 * @returns {string|null} Formatted size (e.g., "1.2 MB") or null if invalid
 */
const formatSize = (contentLengthHeader, fallbackLength) => {
  const bytes = contentLengthHeader ? Number(contentLengthHeader) : fallbackLength;
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

/**
 * Parses CSV text into headers and rows using PapaParse.
 * @param {string} text - Raw CSV file content
 * @returns {{headers: string[], rows: string[][]}} Object with headers array and 2D rows array
 */
const parseCSV = (text) => {
  const result = Papa.parse(text, {
    skipEmptyLines: 'greedy',
  });

  if (Array.isArray(result.errors) && result.errors.length > 0) {
    console.warn('PapaParse detected CSV issues', result.errors);
  }

  const data = Array.isArray(result.data) ? result.data : [];
  const trimmed = data.filter(
    (row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''),
  );

  const headers = trimmed[0] ?? [];
  const rows = trimmed.slice(1);

  return { headers, rows };
};

/**
 * CSV file browser and preview component.
 * Auto-discovers CSV files from src/data, displays a file list, and renders selected file as a table.
 */
function CsvViewer() {
  const [files, setFiles] = useState(() => []);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [tableData, setTableData] = useState({ headers: [], rows: [] });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const parsedCacheRef = useRef(new Map());
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [accountToRename, setAccountToRename] = useState(null);
  const [accountToMove, setAccountToMove] = useState(null);
  
  // Server sync state
  const [serverOnline, setServerOnline] = useState(false);
  const [serverAccounts, setServerAccounts] = useState(new Set());

  const discoveredFiles = useMemo(() => {
    // Bundled CSV files from src/data
    const bundledFiles = Object.entries(csvModules).map(([path, url]) => {
      const segments = path.split('/');
      const name = segments[segments.length - 1];
      return {
        id: path,
        name,
        relativePath: path.replace('../data/', ''),
        url,
        size: null,
        source: 'bundled',
      };
    });

    // User-created files from localStorage (stored as JSON, displayed as CSV)
    const storedAccounts = listAccounts();
    const storedFiles = storedAccounts.map((accountName) => {
      const transactions = getTransactions(accountName);
      const csvText = transactionsToCSV(transactions);
      const blob = new Blob([csvText], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      // Determine source: if account exists on server, show as server; otherwise localStorage
      const storageSource = serverAccounts.has(accountName) ? 'server' : 'localStorage';
      
      return {
        id: `storage:${accountName}`,
        name: `${accountName}.csv`,
        relativePath: `${accountName}.csv`,
        url,
        size: formatSize(null, csvText.length),
        sizeBytes: csvText.length,
        source: storageSource,
        accountName,
        transactionCount: transactions.length,
      };
    });

    return [...bundledFiles, ...storedFiles].sort((a, b) => a.name.localeCompare(b.name));
  }, [refreshKey, serverAccounts]);

  useEffect(() => {
    setFiles(discoveredFiles);
  }, [discoveredFiles]);

  const handleFileSelection = useCallback(
    async (file) => {
      setSelectedFileId(file.id);
      setStatus('loading');
      setError(null);

      if (parsedCacheRef.current.has(file.id)) {
        const cached = parsedCacheRef.current.get(file.id);
        setTableData(cached.data);
        setStatus('ready');
        return;
      }

      try {
        const response = await fetch(file.url);
        if (!response.ok) {
          throw new Error(`Unable to load ${file.name}`);
        }

        const text = await response.text();
        const parsed = parseCSV(text);
        const updatedSize = formatSize(response.headers.get('content-length'), text.length);

        parsedCacheRef.current.set(file.id, { data: parsed, size: updatedSize });
        setTableData(parsed);
        setStatus('ready');

        setFiles((prev) =>
          prev.map((entry) =>
            entry.id === file.id
              ? {
                  ...entry,
                  size: updatedSize,
                }
              : entry,
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unexpected error');
        setStatus('error');
      }
    },
    [],
  );

  useEffect(() => {
    if (files.length === 0) {
      setSelectedFileId(null);
      setTableData({ headers: [], rows: [] });
      setStatus('idle');
      return;
    }

    const currentlySelected = files.find((entry) => entry.id === selectedFileId);
    if (!currentlySelected) {
      handleFileSelection(files[0]);
    }
  }, [files, handleFileSelection, selectedFileId]);

  // Check server health on mount and when sync is enabled
  useEffect(() => {
    const checkServer = async () => {
      const online = await checkServerHealth();
      setServerOnline(online);
      
      // If server is online, fetch the list of accounts stored on server
      if (online) {
        try {
          const accounts = await fetchAccounts();
          setServerAccounts(new Set(accounts));
        } catch (error) {
          console.warn('Failed to fetch server accounts:', error);
          setServerAccounts(new Set());
        }
      } else {
        setServerAccounts(new Set());
      }
    };
    
    checkServer();
    const interval = setInterval(checkServer, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Refresh server accounts list when files change (account created/deleted/renamed)
  useEffect(() => {
    const updateServerAccounts = async () => {
      if (serverOnline) {
        try {
          const accounts = await fetchAccounts();
          setServerAccounts(new Set(accounts));
        } catch (error) {
          console.warn('Failed to fetch server accounts:', error);
        }
      }
    };
    
    updateServerAccounts();
  }, [refreshKey, serverOnline]);

  // Create a new account with sample transactions
  const handleCreateNewAccount = async (accountName, storageType) => {
    const existingAccounts = listAccounts();
    
    if (existingAccounts.includes(accountName)) {
      console.warn(`Account "${accountName}" already exists.`);
      return;
    }

    const sampleTransactions = [
      {
        Date: new Date().toLocaleDateString('en-AU'),
        TransactionID: '1',
        Description: 'Sample Transaction',
        Category: 'Food',
        Amount: '-15.00',
      },
    ];
    
    // Save to localStorage first
    const success = saveTransactions(accountName, sampleTransactions);
    
    // If server storage requested and server is online, sync to server
    if (success && storageType === 'server' && serverOnline) {
      try {
        await saveAccountToServer(accountName, sampleTransactions);
      } catch (error) {
        console.error('Failed to save to server:', error);
      }
    }
    
    if (success) {
      setRefreshKey(prev => prev + 1); // Refresh file list
    }
  };

  // Delete the currently selected localStorage account
  const handleDeleteAccount = () => {
    const currentFile = files.find(f => f.id === selectedFileId);
    
    if (!currentFile || currentFile.source !== 'localStorage') {
      // TODO: Show error notification
      console.warn('Please select a localStorage file to delete.');
      return;
    }

    setAccountToDelete(currentFile);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (accountToDelete) {
      const success = deleteAccount(accountToDelete.accountName);
      if (success) {
        setRefreshKey(prev => prev + 1); // Refresh file list
        setSelectedFileId(null);
      }
      setAccountToDelete(null);
    }
  };

  // Rename the currently selected localStorage account
  const handleRenameAccount = () => {
    const currentFile = files.find(f => f.id === selectedFileId);
    
    if (!currentFile || currentFile.source !== 'localStorage') {
      console.warn('Please select a localStorage file to rename.');
      return;
    }

    setAccountToRename(currentFile);
    setShowRenameDialog(true);
  };

  const confirmRename = (newName) => {
    if (accountToRename) {
      const existingAccounts = listAccounts();
      
      if (existingAccounts.includes(newName)) {
        console.warn(`Account "${newName}" already exists.`);
        return;
      }

      const success = renameAccount(accountToRename.accountName, newName);
      if (success) {
        setRefreshKey(prev => prev + 1); // Refresh file list
        setSelectedFileId(`storage:${newName}`); // Select the renamed account
      }
      setAccountToRename(null);
    }
  };

  // Move account between localStorage and server
  const handleMoveAccount = () => {
    const currentFile = files.find(f => f.id === selectedFileId);
    
    if (!currentFile || currentFile.source === 'bundled') {
      console.warn('Cannot move bundled files.');
      return;
    }

    setAccountToMove(currentFile);
    setShowMoveDialog(true);
  };

  const confirmMove = async () => {
    if (!accountToMove) return;

    const accountName = accountToMove.accountName;
    const transactions = getTransactions(accountName);
    
    if (accountToMove.source === 'localStorage') {
      // Move to server
      if (!serverOnline) {
        console.warn('Server is offline. Cannot move to server.');
        return;
      }
      
      try {
        await saveAccountToServer(accountName, transactions);
        setRefreshKey(prev => prev + 1);
        console.log(`Moved ${accountName} to server`);
      } catch (error) {
        console.error('Failed to move to server:', error);
      }
    } else {
      // Move from server to localStorage-only
      try {
        await deleteAccountFromServer(accountName);
        setRefreshKey(prev => prev + 1);
        console.log(`Removed ${accountName} from server (now localStorage only)`);
      } catch (error) {
        console.error('Failed to remove from server:', error);
      }
    }
    
    setAccountToMove(null);
  };

  // Get localStorage usage statistics
  const getStorageStats = () => {
    let totalBytes = 0;
    const storedAccounts = listAccounts();
    
    storedAccounts.forEach(accountName => {
      const transactions = getTransactions(accountName);
      const csvText = transactionsToCSV(transactions);
      totalBytes += csvText.length;
    });

    // Estimate localStorage limit (typically 5-10MB, we'll use 5MB as conservative estimate)
    const limitBytes = 5 * 1024 * 1024;
    const usedFormatted = formatSize(null, totalBytes);
    const limitFormatted = formatSize(null, limitBytes);
    const percentUsed = ((totalBytes / limitBytes) * 100).toFixed(1);

    return { usedFormatted, limitFormatted, percentUsed, totalBytes, limitBytes };
  };

  const storageStats = useMemo(() => getStorageStats(), [refreshKey]);
  const selectedFile = files.find(f => f.id === selectedFileId);

  // Export all localStorage accounts as CSV files in a ZIP archive
  const handleExportAll = async () => {
    const storedAccounts = listAccounts();
    
    if (storedAccounts.length === 0) {
      console.warn('No localStorage accounts to export.');
      return;
    }

    try {
      const zip = new JSZip();
      
      // Add each account's CSV to the ZIP
      storedAccounts.forEach(accountName => {
        const transactions = getTransactions(accountName);
        const csvText = transactionsToCSV(transactions);
        zip.file(`${accountName}.csv`, csvText);
      });

      // Generate ZIP file
      const blob = await zip.generateAsync({ type: 'blob' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `budget-transactions-${new Date().toISOString().split('T')[0]}.zip`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to create ZIP archive:', error);
    }
  };

  // Export single selected account
  const handleExportSelected = () => {
    const currentFile = files.find(f => f.id === selectedFileId);
    
    if (!currentFile || currentFile.source !== 'localStorage') {
      console.warn('Please select a localStorage file to export.');
      return;
    }

    const transactions = getTransactions(currentFile.accountName);
    const csvText = transactionsToCSV(transactions);
    
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentFile.accountName}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <CreateAccountDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateNewAccount}
        serverOnline={serverOnline}
      />

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setAccountToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Account"
        message={`Are you sure you want to delete ${accountToDelete?.accountName}? This cannot be undone.`}
        confirmText="Delete"
      />

      <InputDialog
        isOpen={showRenameDialog}
        onClose={() => {
          setShowRenameDialog(false);
          setAccountToRename(null);
        }}
        onSubmit={confirmRename}
        title="Rename Account"
        label="New Account Name"
        placeholder={accountToRename?.accountName || ''}
        submitText="Rename"
      />

      <ConfirmDialog
        isOpen={showMoveDialog}
        onClose={() => {
          setShowMoveDialog(false);
          setAccountToMove(null);
        }}
        onConfirm={confirmMove}
        title={accountToMove?.source === 'localStorage' ? 'Move to Server' : 'Remove from Server'}
        message={
          accountToMove?.source === 'localStorage'
            ? `Move ${accountToMove?.accountName} to server storage? The account will be synced to the server.`
            : `Remove ${accountToMove?.accountName} from server? The account will remain in localStorage only.`
        }
        confirmText={accountToMove?.source === 'localStorage' ? 'Move to Server' : 'Remove from Server'}
      />

      <div className="directory-view">
      <div className="file-list-pane">
        <h2 className="pane-title">Available CSV Files</h2>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button 
            type="button" 
            onClick={() => setShowCreateDialog(true)}
            className="button-primary"
            style={{ flex: 1 }}
          >
            New
          </button>
          <button 
            type="button" 
            onClick={handleMoveAccount}
            className="button-secondary"
            style={{ flex: 1 }}
            disabled={!selectedFile || selectedFile.source === 'bundled'}
            title={selectedFile?.source === 'localStorage' ? 'Move to server' : selectedFile?.source === 'server' ? 'Remove from server' : 'Cannot move bundled files'}
          >
            Move
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button 
            type="button" 
            onClick={handleRenameAccount}
            className="button-secondary"
            style={{ flex: 1 }}
          >
            Rename
          </button>
          <button 
            type="button" 
            onClick={handleDeleteAccount}
            className="button-danger"
            style={{ flex: 1 }}
          >
            Delete
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button 
            type="button" 
            onClick={handleExportSelected}
            className="button-secondary"
            style={{ flex: 1 }}
          >
            Export
          </button>
          <button 
            type="button" 
            onClick={handleExportAll}
            className="button-secondary"
            style={{ flex: 1 }}
          >
            Export All
          </button>
        </div>
        <div className="storage-stats">
          <div className="storage-label">localStorage Usage</div>
          <div className="storage-usage">
            {storageStats.usedFormatted} / {storageStats.limitFormatted} ({storageStats.percentUsed}%)
          </div>
          <div className="storage-bar">
            <div className="storage-bar-fill" style={{ width: `${storageStats.percentUsed}%` }}></div>
          </div>
        </div>
        <div className="server-status">
          <div className="storage-label">Server Status</div>
          <div style={{ fontSize: '0.9rem', marginTop: '4px' }}>
            <span style={{ color: serverOnline ? '#4ade80' : '#f87171' }}>
              {serverOnline ? '🟢 Online' : '🔴 Offline'}
            </span>
            {serverOnline && (
              <span style={{ marginLeft: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                ({serverAccounts.size} account{serverAccounts.size !== 1 ? 's' : ''} on server)
              </span>
            )}
          </div>
        </div>
        <div className="file-list">
          {files.length === 0 && <div className="empty-state">Add CSV files under src/data to see them here.</div>}
          {files.map((file) => (
            <button
              key={file.id}
              type="button"
              className={`file-item ${selectedFileId === file.id ? 'selected' : ''}`}
              onClick={() => handleFileSelection(file)}
            >
              <span className="file-name">{file.relativePath}</span>
              <span className="file-info">
                {file.source === 'localStorage' && <span className="file-badge badge-localstorage">💾 JSON (localStorage)</span>}
                {file.source === 'server' && <span className="file-badge badge-server">☁️ JSON (Server)</span>}
                {file.source === 'bundled' && <span className="file-badge badge-bundled">📁 CSV (Bundled)</span>}
                {file.size && <span className="file-size">{file.size}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="preview-pane">
        <h2 className="pane-title">Preview</h2>
        {selectedFile && status === 'ready' && (
          <div className="file-metadata">
            <div className="metadata-row">
              <span className="metadata-label">Source:</span>
              <span className="metadata-value">
                {selectedFile.source === 'localStorage' ? '📦 localStorage' : '📁 Bundled (src/data)'}
              </span>
            </div>
            {selectedFile.source === 'localStorage' && (
              <>
                <div className="metadata-row">
                  <span className="metadata-label">Transactions:</span>
                  <span className="metadata-value">{selectedFile.transactionCount}</span>
                </div>
                <div className="metadata-row">
                  <span className="metadata-label">Size:</span>
                  <span className="metadata-value">{selectedFile.size}</span>
                </div>
                <div className="metadata-warning">
                  ⚠️ Data stored in browser localStorage. Export regularly to avoid data loss.
                </div>
              </>
            )}
            {selectedFile.source === 'bundled' && selectedFile.size && (
              <div className="metadata-row">
                <span className="metadata-label">Size:</span>
                <span className="metadata-value">{selectedFile.size}</span>
              </div>
            )}
          </div>
        )}
        {status === 'idle' && <div className="placeholder">Select a CSV file to preview its contents.</div>}
        {status === 'loading' && <div className="placeholder">Loading file…</div>}
        {status === 'error' && <div className="error-message">{error}</div>}
        {status === 'ready' && tableData.headers.length > 0 && (
          <div className="table-container">
            <table className="csv-table">
              <thead>
                <tr>
                  {tableData.headers.map((header, index) => (
                    <th key={`${header}-${index}`}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`}>
                    {tableData.headers.map((_, columnIndex) => (
                      <td key={`cell-${rowIndex}-${columnIndex}`}>{row[columnIndex] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {status === 'ready' && tableData.headers.length === 0 && (
          <div className="placeholder">This CSV file has no data to display.</div>
        )}
      </div>
      </div>
    </>
  );
}

export default CsvViewer;