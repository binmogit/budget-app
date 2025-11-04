import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { getTransactions, listAccounts, transactionsToCSV, saveTransactions, deleteAccount, renameAccount, getAccountMetadata, markAsSynced, markAsUnsynced } from '../utils/transactionStorage.js';
import { checkServerHealth, fetchAccounts, fetchAccountTransactions, saveAccountToServer, deleteAccountFromServer, fetchAccountMetadata } from '../utils/serverApi.js';
import AccountNavigator from './AccountNavigator.jsx';
import TransactionViewer from './TransactionViewer.jsx';
import ConflictResolutionDialog from './ConflictResolutionDialog.jsx';
import Toast from './Toast.jsx';

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
 * Account manager component.
 * Combines account navigation and transaction viewing/editing functionality.
 */
function AccountManager() {
  const [accounts, setAccounts] = useState(() => []);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [tableData, setTableData] = useState({ headers: [], rows: [] });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const parsedCacheRef = useRef(new Map());
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Server sync state
  const [serverOnline, setServerOnline] = useState(false);
  const [serverAccounts, setServerAccounts] = useState(new Set());

  // Conflict resolution state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictData, setConflictData] = useState(null);
  const [conflictAccountId, setConflictAccountId] = useState(null);

  // Toast notification state
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const discoveredAccounts = useMemo(() => {
    // User-created accounts from localStorage (stored as JSON, displayed as CSV)
    const storedAccounts = listAccounts();
    const storedFiles = storedAccounts.map((accountName) => {
      const transactions = getTransactions(accountName);
      const metadata = getAccountMetadata(accountName);
      const csvText = transactionsToCSV(transactions);
      const url = URL.createObjectURL(new Blob([csvText], { type: 'text/csv' }));
      
      // Determine source based on sync status
      let storageSource;
      const isSynced = metadata?.syncedToServer ?? false;
      const existsOnServer = serverAccounts.has(accountName);
      const isServerAccount = metadata?.serverAccount ?? false; // Flag indicating this is a server-associated account
      
      if (isSynced && serverOnline && existsOnServer) {
        // Account is synced and server confirms it exists
        storageSource = 'server';
      } else if (isSynced && !serverOnline) {
        // Account is synced but server is offline (show as server but indicate offline status)
        storageSource = 'serverOffline';
      } else if (isSynced && serverOnline && !existsOnServer) {
        // Account marked as synced but server doesn't have it (server data lost/changed)
        // This is a conflict situation - server may have been reset
        storageSource = 'conflict';
      } else if (!isSynced && (existsOnServer || (!serverOnline && isServerAccount))) {
        // Account exists on server but has unsaved local changes, OR
        // Server is offline and this is a server account with unsaved changes
        storageSource = 'conflict';
      } else {
        // Account is localStorage-only (never associated with server)
        storageSource = 'localStorage';
      }
      
      return {
        id: `storage:${accountName}`,
        name: accountName,
        relativePath: accountName,
        url,
        size: formatSize(null, csvText.length),
        sizeBytes: csvText.length,
        source: storageSource,
        accountName,
        transactionCount: transactions.length,
      };
    });

    // Add server-only accounts (present on server but not in localStorage)
    const serverOnlyFiles = [];
    if (serverOnline) {
      for (const acc of serverAccounts) {
        if (!storedAccounts.includes(acc)) {
          serverOnlyFiles.push({
            id: `server:${acc}`,
            name: acc,
            relativePath: acc,
            url: null,
            size: null,
            sizeBytes: 0,
            source: 'server',
            accountName: acc,
            transactionCount: null,
          });
        }
      }
    }

    return [...storedFiles, ...serverOnlyFiles].sort((a, b) => a.name.localeCompare(b.name));
  }, [refreshKey, serverAccounts, serverOnline]);

  useEffect(() => {
    setAccounts(discoveredAccounts);
  }, [discoveredAccounts]);

  const handleAccountSelection = useCallback(
    async (account) => {
      setSelectedAccountId(account.id);
      setStatus('loading');
      setError(null);

      if (parsedCacheRef.current.has(account.id)) {
        const cached = parsedCacheRef.current.get(account.id);
        setTableData(cached.data);
        setStatus('ready');
        
        // Update account metadata from cache if not already set
        if (!account.size && cached.size) {
          setAccounts((prev) =>
            prev.map((entry) =>
              entry.id === account.id
                ? {
                    ...entry,
                    size: cached.size,
                    transactionCount: cached.data.rows.length,
                  }
                : entry,
            ),
          );
        }
        return;
      }

      try {
        // If account needs conflict resolution or is a server account
        const needsConflictCheck = (account.source === 'conflict' || account.source === 'serverOffline') && serverOnline;
        const isServerAccount = account.source === 'server' && serverOnline;
        
        if (isServerAccount || needsConflictCheck) {
          try {
            const transactions = await fetchAccountTransactions(account.accountName);
            
            // Check if this account also exists in localStorage (possible conflict)
            const localTransactions = getTransactions(account.accountName);
            if (localTransactions.length > 0) {
              // Both versions exist - check for conflicts
              const localMetadata = getAccountMetadata(account.accountName);
              const serverMetadata = await fetchAccountMetadata(account.accountName);
              
              // Show conflict dialog if:
              // 1. Account source is 'conflict' (has unsaved changes), OR
              // 2. Account is marked as unsynced and has different data
              const shouldShowConflict = 
                account.source === 'conflict' || // Always show for conflict badge
                (localMetadata && serverMetadata && !localMetadata.syncedToServer && (
                  localMetadata.lastModified !== serverMetadata.lastModified ||
                  localMetadata.transactionCount !== serverMetadata.transactionCount
                ));
              
              if (shouldShowConflict && localMetadata && serverMetadata) {
                // Show conflict resolution dialog
                const localPreview = localTransactions.slice(0, 3).map(tx => 
                  `${tx.Date} | ${tx.Description} | ${tx.Amount}`
                ).join('\n') + (localTransactions.length > 3 ? '\n...' : '');
                
                const serverPreview = transactions.slice(0, 3).map(tx => 
                  `${tx.Date} | ${tx.Description} | ${tx.Amount}`
                ).join('\n') + (transactions.length > 3 ? '\n...' : '');
                
                setConflictData({
                  local: {
                    transactionCount: localTransactions.length,
                    lastModified: localMetadata.lastModified,
                    preview: localPreview,
                    transactions: localTransactions,
                  },
                  server: {
                    transactionCount: transactions.length,
                    lastModified: serverMetadata.lastModified,
                    preview: serverPreview,
                    transactions: transactions,
                  },
                });
                
                setConflictAccountId(account.id);
                setShowConflictDialog(true);
                setStatus('idle'); // Reset status while waiting for user choice
                return; // Don't load data yet - wait for conflict resolution
              }
            }
            
            // No conflict - proceed normally
            const csvText = transactionsToCSV(transactions);
            const parsed = parseCSV(csvText);
            const updatedSize = formatSize(null, csvText.length);
            
            // Save to localStorage and mark as synced server account
            saveTransactions(account.accountName, transactions, { syncedToServer: true, serverAccount: true });

            // Cache parsed data and update table
            parsedCacheRef.current.set(account.id, { data: parsed, size: updatedSize });
            setTableData(parsed);
            setStatus('ready');

            // Update accounts entry with size and transaction count and generated blob url
            const blobUrl = URL.createObjectURL(new Blob([csvText], { type: 'text/csv' }));
            setAccounts((prev) =>
              prev.map((entry) =>
                entry.id === account.id
                  ? { ...entry, size: updatedSize, transactionCount: transactions.length, url: blobUrl }
                  : entry,
              ),
            );
          } catch (srvErr) {
            throw new Error(`Unable to load server account ${account.accountName}: ${srvErr?.message || srvErr}`);
          }
          return;
        }

        // Fetch localStorage account blob URL
        const response = await fetch(account.url);
        if (!response.ok) {
          throw new Error(`Unable to load ${account.name}`);
        }

        const text = await response.text();
        const parsed = parseCSV(text);
        const updatedSize = formatSize(response.headers.get('content-length'), text.length);

        parsedCacheRef.current.set(account.id, { data: parsed, size: updatedSize, transactionCount: parsed.rows.length });
        setTableData(parsed);
        setStatus('ready');

        setAccounts((prev) =>
          prev.map((entry) =>
            entry.id === account.id
              ? {
                  ...entry,
                  size: updatedSize,
                  transactionCount: parsed.rows.length,
                }
              : entry,
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unexpected error');
        setStatus('error');
      }
    },
    [serverOnline],
  );

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedAccountId(null);
      setTableData({ headers: [], rows: [] });
      setStatus('idle');
      return;
    }

    const currentlySelected = accounts.find((entry) => entry.id === selectedAccountId);
    if (!currentlySelected) {
      handleAccountSelection(accounts[0]);
    }
  }, [accounts, handleAccountSelection, selectedAccountId]);

  // Check server health on mount and when sync is enabled
  useEffect(() => {
    const checkServer = async () => {
      const online = await checkServerHealth();
      setServerOnline(online);
      
      // If server is online, fetch the list of accounts stored on server
      if (online) {
        try {
          const accountsList = await fetchAccounts();
          setServerAccounts(new Set(accountsList));
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

  // Refresh server accounts list when accounts change (account created/deleted/renamed)
  useEffect(() => {
    const updateServerAccounts = async () => {
      if (serverOnline) {
        try {
          const accountsList = await fetchAccounts();
          setServerAccounts(new Set(accountsList));
        } catch (error) {
          console.warn('Failed to fetch server accounts:', error);
        }
      }
    };
    
    updateServerAccounts();
  }, [refreshKey, serverOnline]);

  // Create a new account with sample transactions or imported data
  const handleCreateAccount = async (accountName, storageType, transactions = null) => {
    const existingAccounts = listAccounts();
    
    if (existingAccounts.includes(accountName)) {
      console.warn(`Account "${accountName}" already exists.`);
      return;
    }

    // Use provided transactions or create default sample
    const accountTransactions = transactions || [
      {
        Date: new Date().toLocaleDateString('en-AU'),
        TransactionID: '1',
        Description: 'Sample Transaction',
        Category: 'Food',
        Amount: '-15.00',
      },
    ];
    
    // Determine if this should be marked as synced
    const willSyncToServer = storageType === 'server' && serverOnline;
    
    // Save to localStorage with appropriate sync status
    const success = saveTransactions(accountName, accountTransactions, {
      syncedToServer: willSyncToServer,
      serverAccount: willSyncToServer, // Mark as server account if we're syncing to server
    });
    
    // If server storage requested and server is online, sync to server
    if (success && willSyncToServer) {
      try {
        await saveAccountToServer(accountName, accountTransactions);
        // Mark as synced in case save didn't set it
        markAsSynced(accountName);
      } catch (error) {
        console.error('Failed to save to server:', error);
        // Mark as unsynced since server save failed
        markAsUnsynced(accountName);
      }
    }
    
    if (success) {
      setRefreshKey(prev => prev + 1); // Refresh account list
    }
  };

  // Delete account
  const handleDeleteAccount = async (account) => {
    const isServer = account.source === 'server';
    
    // Delete from localStorage
    const success = deleteAccount(account.accountName);
    
    // If it was a server account, also delete from server
    if (isServer && success) {
      try {
        await deleteAccountFromServer(account.accountName);
      } catch (error) {
        console.error('Failed to delete from server:', error);
      }
    }
    
    if (success) {
      setRefreshKey(prev => prev + 1); // Refresh account list
      setSelectedAccountId(null);
    }
  };

  // Rename account
  const handleRenameAccount = async (account, newName) => {
    const existingAccounts = listAccounts();
    
    if (existingAccounts.includes(newName)) {
      console.warn(`Account "${newName}" already exists.`);
      return;
    }

    const success = renameAccount(account.accountName, newName);
    if (success) {
      setRefreshKey(prev => prev + 1); // Refresh account list
      setSelectedAccountId(`storage:${newName}`); // Select the renamed account
    }
  };

  // Move account between localStorage and server
  const handleMoveAccount = async (account) => {
    const accountName = account.accountName;
    const transactions = getTransactions(accountName);
    
    if (account.source === 'localStorage') {
      // Move to server (localStorage → server)
      if (!serverOnline) {
        showToast('Cannot move to server: Server is offline', 'error');
        return;
      }
      
      try {
        await saveAccountToServer(accountName, transactions);
        markAsSynced(accountName); // Mark as synced after successful server save
        setRefreshKey(prev => prev + 1);
        showToast(`Moved ${accountName} to server`, 'success');
      } catch (error) {
        console.error('Failed to move to server:', error);
        markAsUnsynced(accountName); // Ensure it's marked as unsynced if save failed
        showToast(`Failed to move to server: ${error.message}`, 'error');
      }
    } else {
      // Move from server to localStorage-only (server/serverOffline/conflict → localStorage)
      if (!serverOnline) {
        showToast('Cannot move to localStorage: Server is offline. This prevents accidental data loss.', 'error');
        return;
      }
      
      try {
        await deleteAccountFromServer(accountName);
        markAsUnsynced(accountName); // Mark as unsynced since it's no longer on server
        setRefreshKey(prev => prev + 1);
        showToast(`Removed ${accountName} from server (now localStorage only)`, 'success');
      } catch (error) {
        console.error('Failed to remove from server:', error);
        showToast(`Failed to remove from server: ${error.message}`, 'error');
      }
    }
  };

  // Export single selected account
  const handleExportAccount = async () => {
    const currentAccount = accounts.find(a => a.id === selectedAccountId);
    
    if (!currentAccount) {
      console.warn('Please select an account to export.');
      return;
    }

    try {
      let transactions;
      
      // Fetch from appropriate source
      if (currentAccount.source === 'server') {
        transactions = await fetchAccountTransactions(currentAccount.accountName);
      } else {
        transactions = getTransactions(currentAccount.accountName);
      }
      
      const csvText = transactionsToCSV(transactions);
      
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentAccount.accountName}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export account:', error);
    }
  };

  // Export all accounts (localStorage + server) as CSV files in a ZIP archive
  const handleExportAll = async () => {
    if (accounts.length === 0) {
      console.warn('No accounts to export.');
      return;
    }

    try {
      const zip = new JSZip();
      
      // Add each account's CSV to the ZIP
      for (const account of accounts) {
        let transactions;
        
        // Fetch from appropriate source
        if (account.source === 'server') {
          transactions = await fetchAccountTransactions(account.accountName);
        } else {
          transactions = getTransactions(account.accountName);
        }
        
        const csvText = transactionsToCSV(transactions);
        zip.file(`${account.accountName}.csv`, csvText);
      }

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

  const handleTableDataChange = (newData) => {
    setTableData(newData);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Handle conflict resolution when loading an account
  const handleLoadConflictResolution = async (choice) => {
    setShowConflictDialog(false);
    
    if (!conflictAccountId || !conflictData) {
      return;
    }
    
    const account = accounts.find(a => a.id === conflictAccountId);
    if (!account) {
      return;
    }
    
    try {
      let transactionsToUse;
      
      if (choice === 'local') {
        // User wants to keep local version - save it to server
        transactionsToUse = conflictData.local.transactions;
        await saveAccountToServer(account.accountName, transactionsToUse);
        markAsSynced(account.accountName); // Mark as synced after server save
        showToast('Local version saved to server', 'success');
      } else if (choice === 'server') {
        // User wants to keep server version - save it to localStorage
        transactionsToUse = conflictData.server.transactions;
        saveTransactions(account.accountName, transactionsToUse, { syncedToServer: true, serverAccount: true });
        showToast('Server version saved locally', 'success');
      }
      
      // Load the chosen version into the UI
      const csvText = transactionsToCSV(transactionsToUse);
      const parsed = parseCSV(csvText);
      const updatedSize = formatSize(null, csvText.length);
      
      parsedCacheRef.current.set(account.id, { data: parsed, size: updatedSize });
      setTableData(parsed);
      setStatus('ready');
      
      // Update accounts list
      const blobUrl = URL.createObjectURL(new Blob([csvText], { type: 'text/csv' }));
      setAccounts((prev) =>
        prev.map((entry) =>
          entry.id === account.id
            ? { ...entry, size: updatedSize, transactionCount: transactionsToUse.length, url: blobUrl }
            : entry,
        ),
      );
      
    } catch (error) {
      showToast(`Failed to resolve conflict: ${error.message}`, 'error');
    } finally {
      setConflictData(null);
      setConflictAccountId(null);
      setRefreshKey(prev => prev + 1); // Refresh to update badges
    }
  };

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  return (
    <>
      <ConflictResolutionDialog
        isOpen={showConflictDialog}
        onClose={() => {
          setShowConflictDialog(false);
          setConflictData(null);
          setConflictAccountId(null);
        }}
        onResolve={handleLoadConflictResolution}
        localData={conflictData?.local}
        serverData={conflictData?.server}
        accountName={accounts.find(a => a.id === conflictAccountId)?.accountName}
      />

      <div className="directory-view">
        <AccountNavigator
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={handleAccountSelection}
          serverOnline={serverOnline}
          serverAccounts={serverAccounts}
          refreshKey={refreshKey}
          onCreateAccount={handleCreateAccount}
          onDeleteAccount={handleDeleteAccount}
          onRenameAccount={handleRenameAccount}
          onMoveAccount={handleMoveAccount}
          onExportAccount={handleExportAccount}
          onExportAll={handleExportAll}
        />
        <TransactionViewer
          selectedAccount={selectedAccount}
          tableData={tableData}
          status={status}
          error={error}
          serverOnline={serverOnline}
          onTableDataChange={handleTableDataChange}
          onRefresh={handleRefresh}
        />
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

export default AccountManager;
