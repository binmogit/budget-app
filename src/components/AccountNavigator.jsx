import { useMemo, useState } from 'react';
import { getTransactions, listAccounts, transactionsToCSV } from '../utils/transactionStorage.js';
import CreateAccountDialog from './CreateAccountDialog.jsx';
import InputDialog from './InputDialog.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

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
 * Account navigator sidebar component.
 * Displays list of accounts with create, rename, delete, move, and export operations.
 * 
 * @param {Object} props
 * @param {Array} props.accounts - Array of account file objects
 * @param {string|null} props.selectedAccountId - ID of currently selected account
 * @param {Function} props.onSelectAccount - Callback when account is selected
 * @param {boolean} props.serverOnline - Whether server is online
 * @param {Set} props.serverAccounts - Set of account names stored on server
 * @param {number} props.refreshKey - Key to trigger refresh
 * @param {Function} props.onCreateAccount - Callback to create new account (accountName, storageType, transactions)
 * @param {Function} props.onDeleteAccount - Callback to delete account
 * @param {Function} props.onRenameAccount - Callback to rename account
 * @param {Function} props.onMoveAccount - Callback to move account between storage types
 * @param {Function} props.onExportAccount - Callback to export single account
 * @param {Function} props.onExportAll - Callback to export all accounts
 */
function AccountNavigator({
  accounts,
  selectedAccountId,
  onSelectAccount,
  serverOnline,
  serverAccounts,
  refreshKey,
  onCreateAccount,
  onDeleteAccount,
  onRenameAccount,
  onMoveAccount,
  onExportAccount,
  onExportAll,
}) {
  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [accountToRename, setAccountToRename] = useState(null);
  const [accountToMove, setAccountToMove] = useState(null);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

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

  const handleCreateClick = () => {
    setShowCreateDialog(true);
  };

  const handleCreateSubmit = async (accountName, storageType, transactions, metadata) => {
    setShowCreateDialog(false);
    await onCreateAccount(accountName, storageType, transactions, metadata);
  };

  const handleDeleteClick = () => {
    if (!selectedAccount) {
      console.warn('No account selected.');
      return;
    }
    setAccountToDelete(selectedAccount);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (accountToDelete) {
      await onDeleteAccount(accountToDelete);
      setAccountToDelete(null);
    }
  };

  const handleRenameClick = () => {
    if (!selectedAccount) {
      console.warn('No account selected.');
      return;
    }
    setAccountToRename(selectedAccount);
    setShowRenameDialog(true);
  };

  const confirmRename = async (newName) => {
    if (accountToRename) {
      await onRenameAccount(accountToRename, newName);
      setAccountToRename(null);
    }
  };

  const handleMoveClick = () => {
    if (!selectedAccount) {
      console.warn('No account selected.');
      return;
    }
    if (selectedAccount.source === 'googleSheet') {
      console.warn('Google Sheets accounts cannot be moved.');
      return;
    }
    setAccountToMove(selectedAccount);
    setShowMoveDialog(true);
  };

  const confirmMove = async () => {
    if (accountToMove) {
      await onMoveAccount(accountToMove);
      setAccountToMove(null);
    }
  };

  return (
    <>
      <CreateAccountDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateSubmit}
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

      <div className="file-list-pane">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button 
            type="button" 
            onClick={handleCreateClick}
            className="button-primary"
            style={{ flex: 1 }}
          >
            New
          </button>
          <button 
            type="button" 
            onClick={handleMoveClick}
            className="button-secondary"
            style={{ flex: 1 }}
            disabled={!selectedAccount || selectedAccount.source === 'googleSheet'}
            title={
              selectedAccount?.source === 'googleSheet' 
                ? 'Google Sheets accounts cannot be moved' 
                : selectedAccount?.source === 'localStorage' 
                  ? 'Move to server' 
                  : 'Remove from server'
            }
          >
            Move
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button 
            type="button" 
            onClick={handleRenameClick}
            className="button-secondary"
            style={{ flex: 1 }}
          >
            Rename
          </button>
          <button 
            type="button" 
            onClick={handleDeleteClick}
            className="button-danger"
            style={{ flex: 1 }}
          >
            Delete
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button 
            type="button" 
            onClick={onExportAccount}
            className="button-secondary"
            style={{ flex: 1 }}
          >
            Export
          </button>
          <button 
            type="button" 
            onClick={onExportAll}
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
          {accounts.length === 0 && <div className="empty-state">No accounts yet. Click "New" to create your first account.</div>}
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              className={`file-item ${selectedAccountId === account.id ? 'selected' : ''}`}
              onClick={() => onSelectAccount(account)}
            >
              <span className="file-name">{account.relativePath}</span>
              <span className="file-info">
                {account.source === 'localStorage' && <span className="file-badge badge-localstorage">💾 JSON (localStorage)</span>}
                {account.source === 'server' && <span className="file-badge badge-server">☁️ JSON (Server)</span>}
                {account.source === 'serverOffline' && <span className="file-badge badge-server-offline">⛈️ JSON (Server - Offline)</span>}
                {account.source === 'conflict' && <span className="file-badge badge-conflict">⚠️ Unsaved Changes</span>}
                {account.source === 'googleSheet' && <span className="file-badge badge-google-sheet">📊 Google Sheets</span>}
                {account.size && <span className="file-size">{account.size}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default AccountNavigator;
