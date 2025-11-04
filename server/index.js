import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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
