import { useState, useEffect } from 'react';
import Toast from './Toast.jsx';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Google Sheets setup screen with interactive wizard.
 * Guides users through service account setup or helps them connect sheets.
 */
function SheetsSetupScreen() {
  const [hasCredentials, setHasCredentials] = useState(false);
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  // Check if credentials exist on mount
  useEffect(() => {
    checkCredentials();
  }, []);

  const checkCredentials = async () => {
    setIsChecking(true);
    try {
      const response = await fetch(`${API_BASE_URL}/sheets/credentials`);
      if (response.ok) {
        const data = await response.json();
        setHasCredentials(data.hasCredentials);
        setServiceAccountEmail(data.email || '');
      }
    } catch (error) {
      console.error('Failed to check credentials:', error);
      setHasCredentials(false);
    } finally {
      setIsChecking(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      showToast('Please select a JSON file', 'error');
      return;
    }

    setUploadedFile(file);
  };

  const handleUploadCredentials = async () => {
    if (!uploadedFile) {
      showToast('Please select a credentials file first', 'warning');
      return;
    }

    setIsUploading(true);

    try {
      // Read and validate the file
      const text = await uploadedFile.text();
      const data = JSON.parse(text);

      if (data.type !== 'service_account' || !data.client_email || !data.private_key) {
        showToast('Invalid service account file format', 'error');
        setIsUploading(false);
        return;
      }

      // Upload to server
      const response = await fetch(`${API_BASE_URL}/sheets/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: text,
      });

      if (response.ok) {
        showToast('✓ Credentials uploaded successfully!', 'success');
        setUploadedFile(null);
        await checkCredentials();
      } else {
        const error = await response.json();
        showToast(`Upload failed: ${error.error}`, 'error');
      }
    } catch (error) {
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  };

  if (isChecking) {
    return (
      <div className="screen-card">
        <div className="placeholder">Checking Google Sheets configuration...</div>
      </div>
    );
  }

  return (
    <>
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      <div className="screen-card">
        <header className="screen-header">
          <h1 className="screen-title">📊 Google Sheets Setup</h1>
          <p className="screen-subtitle">
            Connect your Google Sheets to use as a live read-only data source
          </p>
        </header>

        {hasCredentials ? (
          // Credentials configured
          <div className="setup-section">
            <div className="setup-status">
              <div className="status-icon status-success">✓</div>
              <div>
                <h3 className="status-title">Credentials Configured</h3>
                <p className="status-description">
                  Your server is ready to connect to Google Sheets
                </p>
              </div>
            </div>

            <div className="info-box">
              <h3>Service Account Email</h3>
              <div className="copy-field">
                <code className="email-display">{serviceAccountEmail}</code>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => copyToClipboard(serviceAccountEmail)}
                  style={{ marginLeft: '8px' }}
                >
                  Copy
                </button>
              </div>
              <p className="info-note">
                Share your Google Sheets with this email address (Viewer permission)
              </p>
            </div>

            <div className="steps-box">
              <h3>How to Connect a Sheet</h3>
              <ol className="setup-steps">
                <li>
                  <strong>Open your Google Sheet</strong>
                  <div className="step-detail">The sheet with your transaction data</div>
                </li>
                <li>
                  <strong>Click the Share button</strong>
                  <div className="step-detail">In the top-right corner</div>
                </li>
                <li>
                  <strong>Add the service account email</strong>
                  <div className="step-detail">
                    Paste: <code>{serviceAccountEmail}</code>
                  </div>
                </li>
                <li>
                  <strong>Set permission to &quot;Viewer&quot;</strong>
                  <div className="step-detail">Read-only access is all we need</div>
                </li>
                <li>
                  <strong>Click Send</strong>
                  <div className="step-detail">No need to notify via email</div>
                </li>
                <li>
                  <strong>Go to CSV Explorer → New → 📊 Connect Google Sheets</strong>
                  <div className="step-detail">Enter your Sheet URL and sheet name</div>
                </li>
              </ol>
            </div>

            <div className="reconfigure-section">
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setHasCredentials(false);
                  setServiceAccountEmail('');
                }}
              >
                Upload Different Credentials
              </button>
            </div>
          </div>
        ) : (
          // No credentials - show setup wizard
          <div className="setup-section">
            <div className="setup-status">
              <div className="status-icon status-warning">⚠️</div>
              <div>
                <h3 className="status-title">Setup Required</h3>
                <p className="status-description">
                  Upload your Google Cloud service account credentials to get started
                </p>
              </div>
            </div>

            <div className="info-box" style={{ borderColor: 'var(--error)', backgroundColor: 'rgba(220, 38, 38, 0.1)' }}>
              <h3 style={{ color: 'var(--error)' }}>⚠️ Security Warning</h3>
              <p style={{ marginBottom: '8px' }}>
                <strong>Your credentials file grants access to any Google Sheet you share with it.</strong>
              </p>
              <ul style={{ marginLeft: '20px', fontSize: '0.9em' }}>
                <li>Never share your credentials file publicly</li>
                <li>Never commit it to version control (already in .gitignore)</li>
                <li>Only share sheets containing data you trust this app with</li>
                <li>Monitor Google Cloud Console for unexpected usage</li>
                <li>Rotate credentials every 90 days for security</li>
              </ul>
              <p style={{ fontSize: '0.85em', marginTop: '8px', color: 'var(--text-secondary)' }}>
                For personal use only. Not suitable for production deployments without additional security measures.
              </p>
            </div>

            <div className="steps-box">
              <h3>Step 1: Create Service Account (One-time setup)</h3>
              <ol className="setup-steps">
                <li>
                  <strong>Go to Google Cloud Console</strong>
                  <div className="step-detail">
                    <a 
                      href="https://console.cloud.google.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)' }}
                    >
                      https://console.cloud.google.com/
                    </a>
                  </div>
                </li>
                <li>
                  <strong>Create/Select a Project</strong>
                  <div className="step-detail">Click project dropdown → New Project → Name it &quot;Budget App&quot;</div>
                </li>
                <li>
                  <strong>Enable Google Sheets API</strong> <span style={{ color: 'var(--error)', fontWeight: 'bold' }}>⚠️ CRITICAL</span>
                  <div className="step-detail">
                    APIs & Services → Library → Search &quot;Google Sheets API&quot; → Enable
                  </div>
                  <div className="step-detail" style={{ color: 'var(--error)', marginTop: '4px' }}>
                    Without this step, you&apos;ll get &quot;403 Permission Denied&quot; errors!
                  </div>
                </li>
                <li>
                  <strong>Create Service Account</strong>
                  <div className="step-detail">
                    APIs & Services → Credentials → Create Credentials → Service Account
                  </div>
                </li>
                <li>
                  <strong>Generate Key</strong>
                  <div className="step-detail">
                    Click service account → Keys tab → Add Key → Create new key → JSON → Create
                  </div>
                </li>
              </ol>
            </div>

            <div className="upload-box">
              <h3>Step 2: Upload Credentials File</h3>
              <p className="upload-description">
                Select the JSON file you downloaded from Google Cloud
              </p>
              
              <div className="file-upload-area">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  id="credentials-upload"
                  style={{ display: 'none' }}
                />
                <label htmlFor="credentials-upload" className="upload-label">
                  {uploadedFile ? (
                    <div className="upload-selected">
                      <span className="upload-icon">📄</span>
                      <span className="upload-filename">{uploadedFile.name}</span>
                    </div>
                  ) : (
                    <div className="upload-prompt">
                      <span className="upload-icon">📁</span>
                      <span>Click to select credentials.json file</span>
                    </div>
                  )}
                </label>

                {uploadedFile && (
                  <button
                    type="button"
                    className="button-primary"
                    onClick={handleUploadCredentials}
                    disabled={isUploading}
                    style={{ marginTop: '1rem' }}
                  >
                    {isUploading ? 'Uploading...' : 'Upload Credentials'}
                  </button>
                )}
              </div>
            </div>

            <div className="help-box">
              <h4>Need Help?</h4>
              <p>
                See the detailed setup guide:{' '}
                <a 
                  href="https://github.com/binmogit/budget-app/blob/main/GOOGLE_SHEETS_SETUP.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)' }}
                >
                  GOOGLE_SHEETS_SETUP.md
                </a>
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default SheetsSetupScreen;
