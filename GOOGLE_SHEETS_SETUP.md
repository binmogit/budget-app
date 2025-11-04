# Google Sheets Integration Setup

This guide explains how to set up Google Sheets API access for the Budget App.

## ⚠️ Important Security & Cost Warnings

**Before you begin, understand these risks:**

1. **Google Cloud Costs**: While the Google Sheets API has a generous free tier (unlimited read requests for personal use), other Google Cloud services may incur charges. Monitor your usage in the Google Cloud Console.

2. **Service Account Security**: 
   - Service account credentials (`credentials.json`) provide access to any sheet shared with that account
   - **NEVER commit credentials to version control** (already in `.gitignore`)
   - **NEVER share your credentials file publicly**
   - If credentials are leaked, revoke them immediately in Google Cloud Console
   - Rotate credentials regularly (every 90 days recommended)

3. **Data Privacy**:
   - Service accounts can access any Google Sheet you share with them
   - Only share sheets containing data you're comfortable with this app accessing
   - Consider using test data during initial setup

4. **API Quotas**: 
   - Google Sheets API has rate limits (60 requests/minute/user by default)
   - Exceeding limits may cause temporary errors
   - Production deployments should implement caching and rate limiting

5. **Account Ownership**:
   - Service accounts belong to a Google Cloud project
   - If you delete the project, the service account stops working
   - Keep track of which project owns your credentials

**For personal use only**: This setup is designed for individual users managing their own financial data. Not suitable for multi-tenant production deployments without additional security measures.

---

## Quick Setup (Recommended)

We've created an interactive setup wizard to make this easy!

```bash
npm run setup:sheets
```

The wizard will:
- ✓ Auto-detect service account credentials in your Downloads folder
- ✓ Copy them to the correct location
- ✓ Show you the service account email to share your sheet with
- ✓ Provide next steps

**That's it!** The wizard handles everything automatically.

---

## Manual Setup (Alternative)

If you prefer to set up manually or need more control:

### Option 1: Service Account (Recommended for Server Deployments)

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google Sheets API** ⚠️ **CRITICAL STEP**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"
   - **Wait a few minutes** for the API to activate (usually instant, but can take up to 5 minutes)
   - Without this step, you'll get "403 Permission Denied" errors

3. **Create Service Account**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Fill in the details and create

4. **Generate Key**
   - Click on the created service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose JSON format
   - Download the key file

5. **Configure Server**
   - Rename the downloaded file to `credentials.json`
   - Place it in `server/credentials.json`
   - **Important**: Add `server/credentials.json` to `.gitignore` (already done)

6. **Share Your Sheet**
   - Open the Google Sheet you want to connect
   - Click "Share" button
   - Add the service account email (found in `credentials.json` as `client_email`)
   - Grant "Viewer" access
   - Click "Send" (you can uncheck "Notify people")

### Option 2: Publicly Accessible Sheets

For testing or public data:

1. Open your Google Sheet
2. Click "Share" > "Anyone with the link"
3. Set permission to "Viewer"
4. The app can now access the sheet without authentication

## Sheet Format Requirements

Your Google Sheet must follow this structure:

### Required Columns
- **Date**: Transaction date (DD/MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD)
- **TransactionID**: Unique identifier for each transaction
- **Description**: Transaction description
- **Category**: Transaction category
- **Amount**: Transaction amount (positive = income, negative = expense)

### Alternative Format
Instead of `Amount`, you can use:
- **Debit**: Expense amounts (will be converted to negative)
- **Credit**: Income amounts (will be converted to positive)

### Example Sheet

| Date       | TransactionID | Description      | Category | Amount  |
|------------|---------------|------------------|----------|---------|
| 2025-11-04 | 1             | Grocery Store    | Food     | -45.80  |
| 2025-11-03 | 2             | Salary Payment   | Income   | 2500.00 |
| 2025-11-02 | 3             | Coffee Shop      | Food     | -5.50   |

## Using Google Sheets in the App

1. **Create New Account**
   - Click "New" in Account Manager
   - Select "📊 Connect Google Sheets"
   - Enter the Sheet URL or ID
   - Enter the sheet name (e.g., "Sheet1" or "Transactions")
   - Click "Create"

2. **Refresh Data**
   - Open the Google Sheets account
   - Click "Refresh from Sheet" to fetch latest data
   - Data is cached locally for offline viewing

3. **Read-Only Mode**
   - Google Sheets accounts are read-only
   - Make all changes in your Google Sheet
   - Click "Refresh" to see updates in the app

## Troubleshooting

### "Permission denied" or "API has not been used" Error
- **Most Common**: Enable the Google Sheets API in your Google Cloud project
- Visit: APIs & Services > Library > Search "Google Sheets API" > Enable
- Wait a few minutes after enabling for changes to propagate
- Ensure the sheet is shared with your service account email
- OR ensure the sheet is set to "Anyone with the link can view"

### "Sheet not found" Error
- Verify the Sheet ID is correct
- Check the sheet name matches exactly (case-sensitive)
- Ensure the sheet isn't in the trash

### "Failed to fetch sheet data" Error
- Check `server/credentials.json` exists and is valid JSON
- Verify the server is running (`npm run server`)
- Check server logs for detailed error messages

## Security Notes

**Critical Security Practices:**

- ✗ **NEVER commit `server/credentials.json` to version control** (already in `.gitignore`)
- ✗ **NEVER share credentials in screenshots, logs, or error messages**
- ✗ **NEVER use production credentials in development/testing**
- ✓ **DO** rotate service account keys every 90 days minimum
- ✓ **DO** use separate service accounts for different environments
- ✓ **DO** monitor Google Cloud Console for unexpected API usage
- ✓ **DO** revoke credentials immediately if you suspect they're compromised

**Least Privilege Principle:**
- Service account credentials have read-only access (spreadsheets.readonly scope)
- Only share sheets you actually want this app to access
- Consider creating a dedicated Google account for budget sheets

**Production Deployment Considerations:**
- Use environment variables for credentials (not files)
- Implement request rate limiting to avoid quota exhaustion
- Add audit logging for all sheet access
- Consider OAuth 2.0 user authentication instead of service accounts
- Enable Google Cloud audit logs to track API usage

**What to do if credentials are leaked:**
1. Go to Google Cloud Console → IAM & Admin → Service Accounts
2. Find your service account and click it
3. Go to "Keys" tab
4. Delete the compromised key immediately
5. Generate a new key and update your app
6. Review Cloud Console audit logs for unauthorized access
7. Consider rotating all service accounts in the project

## Further Reading

- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Service Account Authentication](https://cloud.google.com/iam/docs/service-accounts)
- [OAuth 2.0 for Web Apps](https://developers.google.com/identity/protocols/oauth2/web-server)
