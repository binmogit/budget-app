import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

/* global process */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');

// Middleware
app.use(cors());
app.use(express.json());

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * GET /api/accounts
 * List all account names
 */
app.get('/api/accounts', async (req, res) => {
  try {
    await ensureDataDir();
    const files = await fs.readdir(DATA_DIR);
    const accounts = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
    res.json({ accounts });
  } catch (error) {
    console.error('Error listing accounts:', error);
    res.status(500).json({ error: 'Failed to list accounts' });
  }
});

/**
 * GET /api/accounts/:name
 * Get transactions for a specific account
 */
app.get('/api/accounts/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const filePath = path.join(DATA_DIR, `${name}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const transactions = JSON.parse(data);
      res.json({ transactions });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Account not found' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error reading account:', error);
    res.status(500).json({ error: 'Failed to read account' });
  }
});

/**
 * GET /api/accounts/:name/metadata
 * Get metadata for a specific account without downloading full transaction data
 */
app.get('/api/accounts/:name/metadata', async (req, res) => {
  try {
    const { name } = req.params;
    const filePath = path.join(DATA_DIR, `${name}.json`);
    
    try {
      const stats = await fs.stat(filePath);
      const data = await fs.readFile(filePath, 'utf-8');
      const transactions = JSON.parse(data);
      
      res.json({
        lastModified: stats.mtimeMs,
        transactionCount: Array.isArray(transactions) ? transactions.length : 0,
        size: stats.size,
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Account not found' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error reading account metadata:', error);
    res.status(500).json({ error: 'Failed to read account metadata' });
  }
});

/**
 * POST /api/accounts/:name
 * Create or update an account's transactions
 */
app.post('/api/accounts/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { transactions } = req.body;

    if (!Array.isArray(transactions)) {
      return res.status(400).json({ error: 'Transactions must be an array' });
    }

    await ensureDataDir();
    const filePath = path.join(DATA_DIR, `${name}.json`);
    await fs.writeFile(filePath, JSON.stringify(transactions, null, 2));
    
    res.json({ success: true, message: 'Account saved' });
  } catch (error) {
    console.error('Error saving account:', error);
    res.status(500).json({ error: 'Failed to save account' });
  }
});

/**
 * DELETE /api/accounts/:name
 * Delete an account
 */
app.delete('/api/accounts/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const filePath = path.join(DATA_DIR, `${name}.json`);
    
    try {
      await fs.unlink(filePath);
      res.json({ success: true, message: 'Account deleted' });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Account not found' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

/**
 * PUT /api/accounts/:oldName/rename
 * Rename an account
 */
app.put('/api/accounts/:oldName/rename', async (req, res) => {
  try {
    const { oldName } = req.params;
    const { newName } = req.body;

    if (!newName) {
      return res.status(400).json({ error: 'New name is required' });
    }

    const oldPath = path.join(DATA_DIR, `${oldName}.json`);
    const newPath = path.join(DATA_DIR, `${newName}.json`);

    // Check if new name already exists
    try {
      await fs.access(newPath);
      return res.status(409).json({ error: 'Account with new name already exists' });
    } catch {
      // New name doesn't exist, continue
    }

    // Rename the file
    try {
      await fs.rename(oldPath, newPath);
      res.json({ success: true, message: 'Account renamed' });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Account not found' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error renaming account:', error);
    res.status(500).json({ error: 'Failed to rename account' });
  }
});

/**
 * POST /api/sync
 * Sync all accounts from client to server
 */
app.post('/api/sync', async (req, res) => {
  try {
    const { accounts } = req.body;

    if (!accounts || typeof accounts !== 'object') {
      return res.status(400).json({ error: 'Invalid sync data' });
    }

    await ensureDataDir();
    
    const results = [];
    for (const [accountName, transactions] of Object.entries(accounts)) {
      try {
        const filePath = path.join(DATA_DIR, `${accountName}.json`);
        await fs.writeFile(filePath, JSON.stringify(transactions, null, 2));
        results.push({ account: accountName, success: true });
      } catch (error) {
        results.push({ account: accountName, success: false, error: error.message });
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('Error syncing accounts:', error);
    res.status(500).json({ error: 'Failed to sync accounts' });
  }
});

/**
 * POST /api/sheets/fetch
 * Fetch transaction data from Google Sheets
 * Proxies Google Sheets API calls to keep OAuth credentials secure
 * For public sheets without credentials, tries CSV export URL
 */
app.post('/api/sheets/fetch', async (req, res) => {
  try {
    const { sheetId, sheetName } = req.body;

    console.log('=== Google Sheets Fetch Request ===');
    console.log('Sheet ID:', sheetId);
    console.log('Sheet Name:', sheetName);

    if (!sheetId || !sheetName) {
      return res.status(400).json({ error: 'Sheet ID and sheet name are required' });
    }

    // Try to use service account credentials if available
    let auth;
    const credentialsPath = path.join(__dirname, 'credentials.json');
    let hasCredentials = false;
    
    try {
      await fs.access(credentialsPath);
      console.log('✓ Credentials file found at:', credentialsPath);
      
      // Credentials file exists, use it
      auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
      hasCredentials = true;
      
      // Get the client email for logging
      const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf-8'));
      console.log('✓ Using service account:', credentials.client_email);
    } catch (error) {
      console.log('✗ No credentials.json found:', error.message);
    }

    // If we have credentials, use the API
    if (hasCredentials) {
      const sheets = google.sheets({ version: 'v4', auth });

      console.log('→ Attempting to fetch sheet data...');
      
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${sheetName}!A:Z`,
        });

        console.log('✓ Successfully fetched sheet data');
        console.log('  Rows returned:', response.data.values?.length || 0);

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
          return res.json({ transactions: [] });
        }

        const transactions = parseSheetRows(rows);
        console.log('✓ Parsed transactions:', transactions.length);
        return res.json({ transactions });
      } catch (apiError) {
        console.error('✗ Google Sheets API error details:', {
          message: apiError.message,
          code: apiError.code,
          errors: apiError.errors,
          sheetId,
          sheetName
        });
        
        // Provide helpful error message based on error code
        let errorMessage = apiError.message;
        if (apiError.code === 404) {
          errorMessage = 'Sheet not found. Make sure you:\n1. Shared the sheet with the service account email\n2. Used the correct Sheet ID\n3. Used the correct sheet name (tab name)';
        } else if (apiError.code === 403) {
          errorMessage = 'Permission denied. The sheet must be shared with the service account email with "Viewer" permission.';
        }
        
        return res.status(apiError.code || 500).json({ 
          error: errorMessage
        });
      }
    }

    // No credentials - sheet must be publicly accessible
    // We cannot use the Sheets API without auth, so return helpful error
    return res.status(403).json({ 
      error: 'No authentication configured. Please either:\n\n1. Set up service account (see GOOGLE_SHEETS_SETUP.md)\n2. Or share your sheet URL with your email and we\'ll add API key support\n\nNote: "Anyone with the link" sharing does NOT work with the API without credentials.' 
    });

  } catch (error) {
    console.error('Error fetching Google Sheets data:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch sheet data' 
    });
  }
});

/**
 * Helper function to parse sheet rows into transaction objects
 * Uses same logic as CSV importer: handles Amount OR Debit/Credit columns,
 * auto-generates TransactionID if missing, allows empty Category
 */
function parseSheetRows(rows) {
  console.log('→ Parsing sheet rows...');
  console.log('  First row (headers):', rows[0]);
  console.log('  Second row (sample):', rows[1]);
  
  const headers = rows[0];
  const transactions = [];

  // Detect format based on available columns
  const hasAmount = headers.includes('Amount');
  const hasDebitCredit = (headers.includes('Debit') && headers.includes('Credit')) ||
                         (headers.includes('Debits') && headers.includes('Credits'));
  const hasTransactionID = headers.includes('TransactionID');
  const hasCategory = headers.includes('Category');

  // Determine which column names to use for debit/credit
  const debitCol = headers.includes('Debit') ? 'Debit' : 'Debits';
  const creditCol = headers.includes('Credit') ? 'Credit' : 'Credits';

  console.log('  Column detection:', { hasAmount, hasDebitCredit, hasTransactionID, hasCategory, debitCol, creditCol });

  // Validate we have Date and Description (minimum required)
  if (!headers.includes('Date')) {
    console.log('  ✗ Missing required column: Date');
    return [];
  }
  if (!headers.includes('Description')) {
    console.log('  ✗ Missing required column: Description');
    return [];
  }

  // Validate we have either Amount or both Debit and Credit
  if (!hasAmount && !hasDebitCredit) {
    console.log('  ✗ Must have either "Amount" column or both "Debit" and "Credit" columns');
    return [];
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const transaction = {};
    
    // Map row values to headers
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = row[j] || '';
      transaction[header] = value;
    }

    // Skip empty rows (no Date)
    if (!transaction.Date) {
      continue;
    }

    // Build normalized transaction object
    const normalized = {
      Date: transaction.Date, // TODO: Add date normalization if needed
      TransactionID: hasTransactionID ? transaction.TransactionID : `AUTO-${i}`,
      Description: transaction.Description || '',
      Category: hasCategory ? transaction.Category : '',
    };

    // Handle Amount vs Debit/Credit
    if (hasAmount) {
      normalized.Amount = transaction.Amount;
    } else {
      // Merge Debit/Credit into Amount
      // Debit = expense (negative), Credit = income (positive)
      // Strip currency symbols and commas before parsing
      const debitStr = (transaction[debitCol] || '0').replace(/[$,]/g, '');
      const creditStr = (transaction[creditCol] || '0').replace(/[$,]/g, '');
      const debit = parseFloat(debitStr);
      const credit = parseFloat(creditStr);
      
      if (credit > 0) {
        normalized.Amount = credit.toString();
      } else if (debit > 0) {
        normalized.Amount = (-debit).toString();
      } else {
        normalized.Amount = '0';
      }
    }

    transactions.push(normalized);
  }

  console.log('  ✓ Valid transactions parsed:', transactions.length);
  if (transactions.length > 0) {
    console.log('  Sample transaction:', transactions[0]);
  }

  return transactions;
}

/**
 * GET /api/sheets/credentials
 * Check if credentials are configured
 */
app.get('/api/sheets/credentials', async (req, res) => {
  const credentialsPath = path.join(__dirname, 'credentials.json');
  
  try {
    await fs.access(credentialsPath);
    const content = await fs.readFile(credentialsPath, 'utf-8');
    const data = JSON.parse(content);
    
    res.json({
      hasCredentials: true,
      email: data.client_email,
      projectId: data.project_id,
    });
  } catch {
    res.json({
      hasCredentials: false,
    });
  }
});

/**
 * POST /api/sheets/credentials
 * Upload service account credentials
 */
app.post('/api/sheets/credentials', async (req, res) => {
  try {
    const credentials = req.body;
    
    // Validate credentials format
    if (!credentials || typeof credentials !== 'object') {
      return res.status(400).json({ error: 'Invalid credentials format' });
    }
    
    if (credentials.type !== 'service_account' || !credentials.client_email || !credentials.private_key) {
      return res.status(400).json({ 
        error: 'Invalid service account file. Missing required fields.' 
      });
    }
    
    // Save credentials
    const credentialsPath = path.join(__dirname, 'credentials.json');
    await fs.writeFile(credentialsPath, JSON.stringify(credentials, null, 2));
    
    res.json({ 
      success: true, 
      message: 'Credentials saved successfully',
      email: credentials.client_email,
    });
  } catch (error) {
    console.error('Error saving credentials:', error);
    res.status(500).json({ error: 'Failed to save credentials' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Budget API server running on http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  ensureDataDir();
});
