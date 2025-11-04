/**
 * Google Sheets API client for fetching transaction data.
 * All API calls are proxied through the backend server to keep OAuth credentials secure.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Extracts Google Sheet ID from various URL formats.
 * @param {string} input - Sheet URL or ID
 * @returns {string|null} Extracted Sheet ID or null if invalid
 * @example
 * extractSheetId('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit')
 * // Returns: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
 */
export function extractSheetId(input) {
  if (!input) return null;
  
  // If it's already just an ID (no slashes or special chars), return it
  if (/^[a-zA-Z0-9_-]+$/.test(input.trim())) {
    return input.trim();
  }
  
  // Try to extract from URL
  const urlMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }
  
  return null;
}

/**
 * Fetches transaction data from a Google Sheet.
 * @param {string} sheetId - Google Sheet ID
 * @param {string} sheetName - Name of the sheet/tab within the spreadsheet
 * @returns {Promise<Array<Object>>} Array of transaction objects
 * @throws {Error} If fetch fails or sheet format is invalid
 * @example
 * const transactions = await fetchSheetData('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', 'Transactions');
 */
export async function fetchSheetData(sheetId, sheetName) {
  try {
    const response = await fetch(`${API_BASE_URL}/sheets/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sheetId, sheetName }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch sheet data: ${response.statusText}`);
    }

    const data = await response.json();
    return data.transactions || [];
  } catch (error) {
    console.error('Error fetching Google Sheet data:', error);
    throw error;
  }
}

/**
 * Validates that a Google Sheet has the required columns and format.
 * @param {string} sheetId - Google Sheet ID
 * @param {string} sheetName - Name of the sheet/tab
 * @returns {Promise<Object>} Validation result with {valid: boolean, transactions: Array, error?: string}
 * @example
 * const result = await validateSheetFormat('1BxiM...', 'Sheet1');
 * if (result.valid) {
 *   console.log('Sheet is valid with', result.transactions.length, 'transactions');
 * }
 */
export async function validateSheetFormat(sheetId, sheetName) {
  try {
    const transactions = await fetchSheetData(sheetId, sheetName);
    
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return {
        valid: false,
        transactions: [],
        error: 'Sheet is empty or has no data rows',
      };
    }

    // Only check for truly required columns (Date and Description)
    // TransactionID, Category, and Amount are auto-generated/optional on the server
    const requiredColumns = ['Date', 'Description'];
    const firstRow = transactions[0];
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));
    
    if (missingColumns.length > 0) {
      return {
        valid: false,
        transactions: [],
        error: `Missing required columns: ${missingColumns.join(', ')}`,
      };
    }

    return {
      valid: true,
      transactions,
    };
  } catch (error) {
    return {
      valid: false,
      transactions: [],
      error: error.message || 'Failed to validate sheet format',
    };
  }
}

/**
 * Refreshes cached transaction data from a Google Sheet.
 * Same as fetchSheetData but with clearer naming for refresh operations.
 * @param {string} sheetId - Google Sheet ID
 * @param {string} sheetName - Name of the sheet/tab
 * @returns {Promise<Array<Object>>} Updated transaction array
 */
export async function refreshSheetData(sheetId, sheetName) {
  return fetchSheetData(sheetId, sheetName);
}
