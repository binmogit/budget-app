import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { getTransactions, listAccounts, transactionsToCSV, saveTransactions, deleteAccount, renameAccount } from '../utils/transactionStorage.js';
import { checkServerHealth, fetchAccounts, fetchAccountTransactions, saveAccountToServer, deleteAccountFromServer } from '../utils/serverApi.js';
import AccountNavigator from './AccountNavigator.jsx';
import TransactionViewer from './TransactionViewer.jsx';

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

  const discoveredAccounts = useMemo(() => {
    // User-created accounts from localStorage (stored as JSON, displayed as CSV)
    const storedAccounts = listAccounts();
    const storedFiles = storedAccounts.map((accountName) => {
      const transactions = getTransactions(accountName);
      const csvText = transactionsToCSV(transactions);
      const url = URL.createObjectURL(new Blob([csvText], { type: 'text/csv' }));
      
      // Determine source: if account exists on server as well, mark it 'server'; otherwise localStorage
      const storageSource = serverAccounts.has(accountName) ? 'server' : 'localStorage';
      
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
        // If account is stored on server only, fetch transactions from API
        if (account.source === 'server') {
          try {
            const transactions = await fetchAccountTransactions(account.accountName);
            const csvText = transactionsToCSV(transactions);
            const parsed = parseCSV(csvText);
            const updatedSize = formatSize(null, csvText.length);

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
    [],
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
    
    // Save to localStorage first
    const success = saveTransactions(accountName, accountTransactions);
    
    // If server storage requested and server is online, sync to server
    if (success && storageType === 'server' && serverOnline) {
      try {
        await saveAccountToServer(accountName, accountTransactions);
      } catch (error) {
        console.error('Failed to save to server:', error);
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

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  return (
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
        onTableDataChange={handleTableDataChange}
        onRefresh={handleRefresh}
      />
    </div>
  );
}

export default AccountManager;
