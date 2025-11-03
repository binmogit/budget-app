/**
 * Transaction storage utility using localStorage.
 * Manages user-created transaction data organized by account name.
 */

import { 
  saveAccountToServer, 
  deleteAccountFromServer, 
  renameAccountOnServer
} from './serverApi.js';

const STORAGE_KEY_PREFIX = 'budget_transactions_';

/**
 * Retrieves all transactions for a specific account from localStorage.
 * @param {string} accountName - Name of the account (e.g., 'ING', 'NAB')
 * @returns {Array<Object>} Array of transaction objects with Date, TransactionID, Description, Category, Amount
 * @example
 * const ingTransactions = getTransactions('ING');
 * // Returns: [{Date: '03/11/2025', TransactionID: '1', Description: '...', Category: 'Food', Amount: '-3.80'}, ...]
 */
export function getTransactions(accountName) {
  try {
    const key = STORAGE_KEY_PREFIX + accountName;
    const stored = localStorage.getItem(key);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Failed to retrieve transactions for ${accountName}:`, error);
    return [];
  }
}

/**
 * Saves transactions for a specific account to localStorage.
 * Does NOT automatically sync to server - use saveAccountToServer() explicitly.
 * @param {string} accountName - Name of the account (e.g., 'ING', 'NAB')
 * @param {Array<Object>} transactions - Array of transaction objects
 * @returns {boolean} True if save succeeded, false otherwise
 * @example
 * const success = saveTransactions('ING', [
 *   {Date: '03/11/2025', TransactionID: '1', Description: 'Groceries', Category: 'Food', Amount: '-3.80'}
 * ]);
 */
export function saveTransactions(accountName, transactions) {
  try {
    const key = STORAGE_KEY_PREFIX + accountName;
    localStorage.setItem(key, JSON.stringify(transactions));
    return true;
  } catch (error) {
    console.error(`Failed to save transactions for ${accountName}:`, error);
    return false;
  }
}

/**
 * Adds new transaction rows to an account's storage.
 * Appends to existing data rather than replacing it.
 * @param {string} accountName - Name of the account
 * @param {Array<Object>} newRows - Array of new transaction objects to add
 * @returns {boolean} True if append succeeded, false otherwise
 */
export function addTransactions(accountName, newRows) {
  const existing = getTransactions(accountName);
  const updated = [...existing, ...newRows];
  return saveTransactions(accountName, updated);
}

/**
 * Lists all account names that have stored transactions.
 * @returns {Array<string>} Array of account names (e.g., ['ING', 'NAB'])
 */
export function listAccounts() {
  const accounts = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
      accounts.push(key.replace(STORAGE_KEY_PREFIX, ''));
    }
  }
  return accounts.sort();
}

/**
 * Deletes all transactions for a specific account from localStorage.
 * Does NOT automatically delete from server - caller should use deleteAccountFromServer() if needed.
 * @param {string} accountName - Name of the account to clear
 * @returns {boolean} True if deletion succeeded, false otherwise
 */
export function deleteAccount(accountName) {
  try {
    const key = STORAGE_KEY_PREFIX + accountName;
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Failed to delete account ${accountName}:`, error);
    return false;
  }
}

/**
 * Renames an account by copying data to new name and deleting old one.
 * Optionally syncs rename to server if enabled.
 * @param {string} oldName - Current account name
 * @param {string} newName - New account name
 * @returns {boolean} True if rename succeeded, false otherwise
 */
export function renameAccount(oldName, newName) {
  try {
    // Check if new name already exists
    const existingAccounts = listAccounts();
    if (existingAccounts.includes(newName)) {
      console.error(`Account ${newName} already exists`);
      return false;
    }

    // Get transactions from old account
    const transactions = getTransactions(oldName);
    if (transactions.length === 0) {
      console.error(`No transactions found for ${oldName}`);
      return false;
    }

    // Save to new name
    const saveSuccess = saveTransactions(newName, transactions);
    if (!saveSuccess) {
      return false;
    }

    // Delete old account
    const deleteSuccess = deleteAccount(oldName);
    if (!deleteSuccess) {
      // Rollback: delete the new account we just created
      deleteAccount(newName);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Failed to rename account from ${oldName} to ${newName}:`, error);
    return false;
  }
}

/**
 * Converts transaction objects to CSV format (multi-row).
 * @param {Array<Object>} transactions - Array of transaction objects
 * @returns {string} CSV-formatted string with headers
 * @example
 * const csv = transactionsToCSV(transactions);
 * // Returns: "Date,TransactionID,Description,Category,Amount\n03/11/2025,1,..."
 */
export function transactionsToCSV(transactions) {
  if (!transactions || transactions.length === 0) {
    return 'Date,TransactionID,Description,Category,Amount\n';
  }

  const headers = ['Date', 'TransactionID', 'Description', 'Category', 'Amount'];
  const rows = transactions.map((tx) => {
    return headers
      .map((header) => {
        const value = String(tx[header] ?? '');
        // Escape values containing commas, quotes, or newlines
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
