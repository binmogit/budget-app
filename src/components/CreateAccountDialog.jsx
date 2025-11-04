import { useState } from 'react';
import Papa from 'papaparse';
import Modal from './Modal.jsx';
import { parseAndNormalizeDate } from '../utils/dateUtils.js';

/**
 * Dialog for creating a new account with storage location choice and optional CSV import.
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls dialog visibility
 * @param {Function} props.onClose - Callback when dialog closes without submitting
 * @param {Function} props.onSubmit - Callback with (accountName, storageType, transactions) when user submits
 * @param {boolean} props.serverOnline - Whether server is available
 */
function CreateAccountDialog({ 
  isOpen, 
  onClose, 
  onSubmit,
  serverOnline
}) {
  const [accountName, setAccountName] = useState('');
  const [storageType, setStorageType] = useState('localStorage');
  const [creationType, setCreationType] = useState('sample'); // 'sample', 'empty', or 'import'
  const [csvFile, setCsvFile] = useState(null);
  const [dateFormat, setDateFormat] = useState('auto'); // 'auto', 'dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd'
  const [importError, setImportError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = accountName.trim();
    if (!trimmed) return;

    setImportError(null);

    if (creationType === 'import') {
      // Import CSV file
      if (!csvFile) {
        setImportError('Please select a CSV file to import');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const csvText = event.target.result;
          
          // Parse CSV using PapaParse
          const result = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: 'greedy',
            dynamicTyping: false, // Keep as strings for validation
          });

          if (result.errors && result.errors.length > 0) {
            console.warn('CSV parsing warnings:', result.errors);
          }

          // Validate we have data
          if (!result.data || result.data.length === 0) {
            setImportError('CSV file is empty or contains no valid transactions');
            return;
          }

          const headers = result.meta.fields || [];
          
          // Detect CSV format based on available columns
          const hasAmount = headers.includes('Amount');
          const hasDebitCredit = headers.includes('Debit') && headers.includes('Credit');
          
          // Core required columns (excluding Amount since it can be derived)
          const coreColumns = ['Date', 'TransactionID', 'Description', 'Category'];
          const missingCoreColumns = coreColumns.filter(col => !headers.includes(col));

          if (missingCoreColumns.length > 0) {
            setImportError(`Missing required columns: ${missingCoreColumns.join(', ')}`);
            return;
          }

          // Validate we have either Amount or both Debit and Credit
          if (!hasAmount && !hasDebitCredit) {
            setImportError('CSV must contain either "Amount" column or both "Debit" and "Credit" columns');
            return;
          }

          // Transform CSV rows to transaction objects with date validation
          const transactions = [];
          const dateErrors = [];

          for (let i = 0; i < result.data.length; i++) {
            const row = result.data[i];
            
            // Parse and normalize date with user-specified format hint
            const dateResult = parseAndNormalizeDate(row.Date, dateFormat);
            if (!dateResult.success) {
              dateErrors.push(`Row ${i + 1}: ${dateResult.error}`);
              continue; // Skip this transaction
            }

            // Handle Amount vs Debit/Credit
            let amount;
            if (hasAmount) {
              // Direct Amount column - use as-is
              amount = row.Amount;
            } else {
              // Debit/Credit columns - merge into Amount
              // Debit = expense (negative), Credit = income (positive)
              const debit = parseFloat(row.Debit || '0');
              const credit = parseFloat(row.Credit || '0');
              
              if (credit > 0) {
                amount = credit.toString();
              } else if (debit > 0) {
                amount = (-debit).toString();
              } else {
                amount = '0';
              }
            }

            transactions.push({
              Date: dateResult.date, // Normalized YYYY-MM-DD
              TransactionID: row.TransactionID,
              Description: row.Description,
              Category: row.Category,
              Amount: amount,
            });
          }

          // Report date parsing errors if any
          if (dateErrors.length > 0) {
            const errorSummary = dateErrors.slice(0, 5).join('\n');
            const remaining = dateErrors.length > 5 ? `\n... and ${dateErrors.length - 5} more errors` : '';
            setImportError(`Date parsing errors:\n${errorSummary}${remaining}`);
            return;
          }

          // Ensure we have at least some valid transactions
          if (transactions.length === 0) {
            setImportError('No valid transactions found after date validation');
            return;
          }

          // Submit with imported transactions
          onSubmit(trimmed, storageType, transactions);
          resetForm();
          onClose();
        } catch (error) {
          setImportError(`Failed to parse CSV: ${error.message}`);
        }
      };

      reader.onerror = () => {
        setImportError('Failed to read CSV file');
      };

      reader.readAsText(csvFile);
    } else {
      // Create with sample or empty
      const transactions = creationType === 'sample' ? [
        {
          Date: '2025-11-04', // YYYY-MM-DD format
          TransactionID: '1',
          Description: 'Sample Transaction',
          Category: 'Food',
          Amount: '-15.00',
        }
      ] : [];

      onSubmit(trimmed, storageType, transactions);
      resetForm();
      onClose();
    }
  };

  const resetForm = () => {
    setAccountName('');
    setStorageType('localStorage');
    setCreationType('sample');
    setCsvFile(null);
    setDateFormat('auto');
    setImportError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.csv')) {
        setImportError('Please select a CSV file');
        setCsvFile(null);
        return;
      }
      setCsvFile(file);
      setImportError(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Account">
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="account-name" className="form-label">Account Name</label>
          <input
            id="account-name"
            type="text"
            className="form-input"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="e.g., ING, NAB, Cash"
            autoFocus
          />
        </div>

        <div className="form-field" style={{ marginTop: '1rem' }}>
          <label className="form-label">Creation Method</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="creation"
                value="sample"
                checked={creationType === 'sample'}
                onChange={(e) => setCreationType(e.target.value)}
              />
              <span>
                <strong>📝 Create with sample transaction</strong>
              </span>
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="creation"
                value="empty"
                checked={creationType === 'empty'}
                onChange={(e) => setCreationType(e.target.value)}
              />
              <span>
                <strong>📄 Create empty account</strong>
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="creation"
                value="import"
                checked={creationType === 'import'}
                onChange={(e) => setCreationType(e.target.value)}
              />
              <span>
                <strong>📥 Import from CSV file</strong>
              </span>
            </label>
          </div>

          {creationType === 'import' && (
            <div style={{ marginTop: '0.75rem', paddingLeft: '28px' }}>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{ 
                  fontSize: '0.9rem',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  width: '100%',
                  cursor: 'pointer'
                }}
              />
              {csvFile && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Selected: {csvFile.name}
                </div>
              )}
              
              {csvFile && (
                <div style={{ marginTop: '0.75rem' }}>
                  <label htmlFor="date-format" style={{ fontSize: '0.9rem', fontWeight: '500', display: 'block', marginBottom: '0.25rem' }}>
                    Date Format in CSV
                  </label>
                  <select
                    id="date-format"
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    style={{
                      fontSize: '0.9rem',
                      padding: '0.5rem',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      width: '100%',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="auto">Auto-detect (tries all formats)</option>
                    <option value="dd/mm/yyyy">DD/MM/YYYY (e.g., 04/11/2025 = Nov 4)</option>
                    <option value="mm/dd/yyyy">MM/DD/YYYY (e.g., 04/11/2025 = Apr 11)</option>
                    <option value="yyyy-mm-dd">YYYY-MM-DD (e.g., 2025-11-04)</option>
                  </select>
                  <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Select the date format used in your CSV file to avoid ambiguity.
                  </div>
                </div>
              )}
              
              {importError && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#f87171', whiteSpace: 'pre-line' }}>
                  ⚠️ {importError}
                </div>
              )}
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Required columns: Date, TransactionID, Description, Category, and either Amount OR Debit+Credit.
                Dates will be normalized to YYYY-MM-DD format.
              </div>
            </div>
          )}
        </div>
        
        <div className="form-field" style={{ marginTop: '1rem' }}>
          <label className="form-label">Storage Location</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="storage"
                value="localStorage"
                checked={storageType === 'localStorage'}
                onChange={(e) => setStorageType(e.target.value)}
              />
              <span>
                <strong>💾 Browser Storage</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                  (localStorage - device-specific)
                </span>
              </span>
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: serverOnline ? 'pointer' : 'not-allowed', opacity: serverOnline ? 1 : 0.5 }}>
              <input
                type="radio"
                name="storage"
                value="server"
                checked={storageType === 'server'}
                onChange={(e) => setStorageType(e.target.value)}
                disabled={!serverOnline}
              />
              <span>
                <strong>☁️ Server Storage</strong>
                <span style={{ fontSize: '0.85rem', color: serverOnline ? 'var(--text-secondary)' : '#f87171', marginLeft: '8px' }}>
                  {serverOnline ? '(persists across devices)' : '(server offline)'}
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
          <button 
            type="button" 
            className="button-secondary" 
            onClick={handleClose}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="button-primary"
            disabled={!accountName.trim() || (creationType === 'import' && !csvFile)}
          >
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default CreateAccountDialog;
