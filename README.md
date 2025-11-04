# Budget App

A lightweight personal finance tracker built with React and Vite. Manage transactions across multiple accounts with intelligent CSV import, export backups, and optional server sync—no complex setup required.

## 🚀 Live Demo

**[Try it now →](https://binmogit.github.io/budget-app/)**

The live demo runs in **localStorage-only mode** (no server component). Your data stays private in your browser and is never uploaded anywhere. For full functionality with cross-device sync, run the app locally with the server enabled.

## Features

- **Multi-Account Management** - Create and organize multiple account ledgers (checking, savings, credit cards)
- **Smart CSV Import** - Automatically detects and transforms CSV formats (Amount-based or Debit/Credit columns)
- **Google Sheets Integration** - Connect to live Google Sheets for read-only transaction feeds
- **Flexible Storage** - Choose between browser localStorage (demo/local use) or server-side JSON storage (local setup only)
- **Export & Backup** - Download individual accounts as CSV or export all data as a ZIP archive
- **Split Transactions** - Track expenses across multiple categories with linked TransactionIDs

## Storage Options

### 💾 localStorage (Default in Demo)
- Data stored entirely in your browser
- **Private** - never sent to any server
- **Portable** - works offline, no setup required
- **Volatile** - cleared by browser maintenance or cache clearing
- ⚠️ **Export regularly** to avoid data loss

### ☁️ Server Storage (Local Setup Only)
- Persistent JSON storage across devices
- Requires running the Express server locally (`npm run dev:full`)
- Data stored in `server/data/` directory
- **Not available in the GitHub Pages demo** (everyone would share the same data)
- For personal use: set up your own server or use localhost

### 📊 Google Sheets (Read-Only Live Feed)
- Connect to your Google Sheets as a live data source
- Users maintain transactions in their Google Sheet
- App periodically refreshes and caches data locally
- **Read-only** - make all changes in the sheet, refresh in app
- **Quick Setup**: Run `npm run setup:sheets` - interactive wizard handles everything!
- See [GOOGLE_SHEETS_SETUP.md](./GOOGLE_SHEETS_SETUP.md) for details

## Installation

**Want to try it first?** Check out the **[live demo](https://binmogit.github.io/budget-app/)** (localStorage-only).

### Prerequisites
- Node.js 18+
- Modern browser with localStorage support

### Quick Start

```bash
# Clone and install
git clone https://github.com/binmogit/budget-app.git
cd budget-app
npm install

# Start development server (localStorage only - like the demo)
npm run dev

# OR start with backend server for persistent storage across devices
npm run dev:full
```

The app runs at `http://localhost:5173`. The optional API server runs at `http://localhost:3001`.

## Usage

### Creating Accounts

1. Navigate to **CSV Explorer** from the welcome screen
2. Click **New** and choose:
   - **Create empty** or **with sample transaction**
   - **Import from CSV** - supports standard (Amount column) or bank format (Debit/Credit columns)
3. If importing, select your **date format** (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, or auto-detect) to avoid ambiguity
4. Select storage: 
   - **💾 Browser** (localStorage) - always available
   - **☁️ Server** - only available when running locally with `npm run dev:full`

### Managing Transactions

- **View** - Select an account to display transactions in a table
- **Move** - Transfer accounts between browser and server storage
- **Rename/Delete** - Right-click or use toolbar buttons
- **Export** - Download as CSV or use **Export All** for ZIP backup

### CSV Format

Accounts are stored as JSON internally. Exports use multi-row CSV format:

```csv
Date,TransactionID,Description,Category,Amount
2025-11-03,1,Grocery Store,Food,-45.20
2025-11-03,1,Grocery Store,Household,-12.50
```

## Server Configuration

For persistent cross-device storage, configure the API endpoint:

```bash
# Copy environment template
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:3001/api  # Local development
# VITE_API_URL=https://your-domain.com/api  # Production
```

Server data is stored in `server/data/` as JSON files.

## Development

```bash
npm run dev      # Frontend dev server
npm run server   # API server only
npm run dev:full # Both frontend and backend
npm run build    # Production bundle
npm run lint     # Code quality checks
```

**Tech Stack**: React 19, Vite 7, Express, PapaParse, JSZip

## Contributing

Contributions are welcome! Please:
- Prioritize data integrity and security
- Follow conventions in `.github/copilot-instructions.md`
- Use JSDoc comments for all exported functions
- Test data import/export thoroughly

## License

MIT License - see [LICENSE](LICENSE) for details.

## Important Notes

⚠️ **Browser storage is volatile** - localStorage can be cleared by browser maintenance or device changes. Use **Export All** regularly or run the app locally with server storage enabled for automatic backup.

**Demo vs. Local Setup:**
- **[Live Demo](https://binmogit.github.io/budget-app/)** - localStorage only, no server, data stays in your browser
- **Local Setup** - Full functionality including optional server sync across devices

**No warranty**: This tool is for personal budget tracking only. Always maintain backups of financial data.