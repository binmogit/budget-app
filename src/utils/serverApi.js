/**
 * API client for server-side storage.
 * Provides methods to sync localStorage transactions with backend server.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Fetches all account names from server.
 * @returns {Promise<string[]>} Array of account names
 */
export async function fetchAccounts() {
  const response = await fetch(`${API_BASE_URL}/accounts`);
  if (!response.ok) {
    throw new Error('Failed to fetch accounts from server');
  }
  const data = await response.json();
  return data.accounts;
}

/**
 * Fetches transactions for a specific account from server.
 * @param {string} accountName - Name of the account
 * @returns {Promise<Array<Object>>} Array of transaction objects
 */
export async function fetchAccountTransactions(accountName) {
  const response = await fetch(`${API_BASE_URL}/accounts/${encodeURIComponent(accountName)}`);
  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`Failed to fetch transactions for ${accountName}`);
  }
  const data = await response.json();
  return data.transactions;
}

/**
 * Saves transactions for a specific account to server.
 * @param {string} accountName - Name of the account
 * @param {Array<Object>} transactions - Array of transaction objects
 * @returns {Promise<boolean>} True if save succeeded
 */
export async function saveAccountToServer(accountName, transactions) {
  const response = await fetch(`${API_BASE_URL}/accounts/${encodeURIComponent(accountName)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transactions }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to save account ${accountName} to server`);
  }
  
  return true;
}

/**
 * Deletes an account from server.
 * @param {string} accountName - Name of the account to delete
 * @returns {Promise<boolean>} True if deletion succeeded
 */
export async function deleteAccountFromServer(accountName) {
  const response = await fetch(`${API_BASE_URL}/accounts/${encodeURIComponent(accountName)}`, {
    method: 'DELETE',
  });
  
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete account ${accountName} from server`);
  }
  
  return true;
}

/**
 * Renames an account on server.
 * @param {string} oldName - Current account name
 * @param {string} newName - New account name
 * @returns {Promise<boolean>} True if rename succeeded
 */
export async function renameAccountOnServer(oldName, newName) {
  const response = await fetch(`${API_BASE_URL}/accounts/${encodeURIComponent(oldName)}/rename`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ newName }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to rename account on server');
  }
  
  return true;
}

/**
 * Syncs all localStorage accounts to server.
 * @param {Object} accountsData - Object mapping account names to transaction arrays
 * @returns {Promise<Object>} Sync results for each account
 * @example
 * const accountsData = {
 *   'ING': [{Date: '01/01/2025', TransactionID: '1', ...}],
 *   'NAB': [{Date: '02/01/2025', TransactionID: '2', ...}]
 * };
 * const results = await syncAllToServer(accountsData);
 */
export async function syncAllToServer(accountsData) {
  const response = await fetch(`${API_BASE_URL}/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ accounts: accountsData }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to sync accounts to server');
  }
  
  const data = await response.json();
  return data.results;
}

/**
 * Checks if server is reachable.
 * @returns {Promise<boolean>} True if server is online
 */
export async function checkServerHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch (error) {
    console.warn('Server health check failed:', error);
    return false;
  }
}
