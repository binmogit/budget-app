# Budget App

A lightweight personal budget tracker built with React and Vite. Manage transactions across multiple accounts with browser-based storage, export backups, and track spending patterns locally—no complex setup or external services required.

## Features

### ✅ Implemented
- **JSON Transaction Storage** - Create, rename, and delete account ledgers stored as JSON in browser localStorage or on server
- **Multi-row CSV Export Format** - Export transactions as CSV with split transactions across categories linked by TransactionID
- **Server Sync** - Automatically backup localStorage data to server for cross-device access and persistence
- **Export & Backup** - Download individual accounts as CSV or export all data as a ZIP archive
- **Storage Monitoring** - Real-time localStorage usage tracking with visual indicators
- **Data Security Warnings** - Clear alerts about browser storage volatility to prevent data loss
- **Source Badges** - Distinguish between JSON (localStorage), JSON (Server), and CSV (Bundled) files

### 🚧 In Progress
- **Server-side Backup** - Sync localStorage to persistent server storage for cross-device access
- **Transaction Entry Forms** - Guided UI for creating transactions with split support and validation

### 📋 Planned
- **Inline CSV Editing** - Modify transactions directly in the preview table
- **TransactionID Auto-generation** - Eliminate manual ID entry once storage layer is stable
- **Interactive Charts** - Visualize spending trends and account balances over time with Chart.js
- **Categorization Rules** - Auto-tag transactions based on merchant patterns
- **Budget Allocation** - Set category-level budgets and track monthly envelopes

## Installation

### Prerequisites
- Node.js 18+ (recommended for Vite 7 compatibility)
- Modern browser with localStorage support

### Setup
```bash
# Clone the repository
git clone https://github.com/binmogit/budget-app.git
cd budget-app

# Install dependencies
npm install

# Copy environment example (optional, for server configuration)
cp .env.example .env

# Start development server (frontend only)
npm run dev

# OR start both frontend and API server
npm run dev:full
```

The app will be available at `http://localhost:5173` (frontend) and API at `http://localhost:3001` (if running full stack).

### Running the API Server

The budget app includes an optional backend server for persistent storage:

```bash
# Start API server only
npm run server

# Or run both frontend and backend together
npm run dev:full
```

Server data is stored in `server/data/` as JSON files (one per account).

## Usage

### Creating Accounts
1. Navigate to **CSV Explorer** from the welcome screen
2. Click **New** to create a new account (e.g., "ING", "NAB", "CommSec")
3. Each account starts with a sample transaction

### Managing Transactions
- **View**: Select an account from the file list to preview transactions (rendered as CSV table)
- **Rename**: Select an account and click **Rename** to change its name
- **Delete**: Select an account and click **Delete** (requires confirmation)
- **Export**: Download a single account's data as CSV or use **Export All** for a ZIP archive of all accounts

### Storage Formats
- **localStorage/Server**: User-created accounts are stored as **JSON** (array of transaction objects)
- **Bundled Files**: Example files in `src/data/` are **CSV** format (text files with comma-separated values)
- **Export Format**: All exports use the **multi-row CSV format** for maximum compatibility with spreadsheet apps

### Data Backup
⚠️ **Important**: Browser localStorage is volatile and can be cleared by:
- Browser data wipes
- Switching devices/browsers
- Clearing site data

**Protection options:**
1. **Export Regularly**: Use **Export All** to download timestamped ZIP backups
2. **Enable Server Sync**: Toggle "Server Sync" in CSV Explorer to automatically backup to the API server
   - Server data persists across browser wipes and device changes
   - Survives server restarts (stored in `server/data/`)
   - Must run the API server (`npm run server` or `npm run dev:full`)

## Server-Side Storage

The budget app includes an optional Express API server for persistent backup:

### Features
- **JSON Storage**: Server stores account data as JSON files (`server/data/*.json`)
- **Automatic Sync**: When enabled, all localStorage changes sync to server automatically
- **Cross-Device Access**: Access your data from any browser pointing to the same server
- **Survives Restarts**: Data persists in file system across server restarts
- **REST API**: Standard HTTP endpoints for accounts management

### API Endpoints
```
GET    /api/accounts           # List all accounts
GET    /api/accounts/:name     # Get account transactions
POST   /api/accounts/:name     # Save account transactions
DELETE /api/accounts/:name     # Delete account
PUT    /api/accounts/:oldName/rename  # Rename account
POST   /api/sync               # Sync all accounts at once
GET    /api/health             # Server health check
```

### Configuration
Set the API URL in `.env`:
```env
# Local development (default)
VITE_API_URL=http://localhost:3001/api

# Production server
VITE_API_URL=https://your-domain.com/api
```

### Production Deployment
For production use:
1. Deploy the Express server (`server/index.js`) to your hosting platform
2. Update `.env` with your server URL
3. Add authentication middleware (see Future Enhancements below)
4. Use HTTPS for secure communication

### Future Enhancements (Server)
- [ ] Password protection / authentication
- [ ] Database backend (PostgreSQL/SQLite)
- [ ] Multi-user support
- [ ] Encrypted storage
- [ ] Automatic conflict resolution

## CSV Transaction Format

**For Export and Bundled Files Only**

When you export accounts or work with bundled example files, transactions use a multi-row CSV format where each category allocation gets its own row:

```csv
Date,TransactionID,Description,Category,Amount
03/11/2025,1,THE GOOD GROCER WEMB,Food,-3.80
03/11/2025,1,THE GOOD GROCER WEMB,TobAlc,-2.99
```

### Required Columns
- **Date** - Transaction date (DD/MM/YYYY)
- **TransactionID** - Unique identifier linking split rows
- **Description** - Merchant or transaction note
- **Category** - Income, expense, or account transfer category
- **Amount** - Positive for income, negative for expenses/transfers

**Note**: While the UI displays data as CSV tables and exports to CSV format, user-created accounts are actually stored as **JSON** (both in localStorage and on the server) for efficiency. CSV is only used for bundled example files and export functionality.

### Categories
- **Income**: Gov, Work, Interest, Dividends
- **Accounts**: Cash, NAB, ING, CommSec, PayG, etc.
- **Expenses**: Food, Retail, Rent, Health, Elec, Gas, etc.

## Project Structure

```
budget-app/
├── server/
│   ├── index.js           # Express API server
│   └── data/              # Server-side account storage (git-ignored)
├── src/
│   ├── components/        # React screen components
│   │   ├── CsvViewer.jsx  # Main CSV explorer interface
│   │   ├── Modal.jsx      # Base modal component
│   │   ├── InputDialog.jsx
│   │   ├── ConfirmDialog.jsx
│   │   ├── WelcomeScreen.jsx
│   │   └── TodoList.jsx
│   ├── utils/
│   │   ├── transactionStorage.js  # localStorage operations
│   │   └── serverApi.js           # Server API client
│   ├── data/              # Bundled example CSV files (git-ignored)
│   ├── App.jsx            # Navigation and routing
│   ├── main.jsx           # React entry point
│   └── index.css          # Global styles
├── .github/
│   └── copilot-instructions.md  # Development guidelines
├── .env.example           # Environment configuration template
├── package.json
└── vite.config.js
```

## Development

### Commands
```bash
npm run dev      # Start dev server with hot reload
npm run build    # Build production bundle to dist/
npm run preview  # Preview production build locally
npm run lint     # Check code style and best practices
npm run server   # Start API server only
npm run dev:full # Start both frontend and API server
```

### Tech Stack
- **React 19** - UI framework
- **Vite 7** - Build tool and dev server
- **Express** - Backend API server
- **PapaParse** - CSV parsing
- **JSZip** - ZIP archive creation
- **Chart.js** (planned) - Data visualization

## Roadmap

### Phase 1: Data Security ✅
- [x] localStorage persistence
- [x] Export functionality
- [x] Storage warnings
- [x] Server-side backup (basic implementation)

### Phase 2: Transaction Management 🚧
- [ ] Password protection for server
- [ ] Guided entry forms
- [ ] Split transaction support
- [ ] TransactionID auto-generation
- [ ] Inline editing

### Phase 3: Insights 📋
- [ ] Interactive charts
- [ ] Budget tracking
- [ ] Categorization rules
- [ ] Reporting dashboard

## Contributing

This is a lightweight budget tracking tool. Contributions are welcome, but please:
- Prioritize data integrity and user experience
- Never introduce features that could silently lose user data
- Follow the conventions in `.github/copilot-instructions.md`
- Use JSDoc comments for all exported functions

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Notes & Disclaimers

- **Storage Format**: User accounts are stored as JSON in localStorage/server; CSV format is only for exports and bundled examples
- **Browser Storage**: localStorage data can be cleared by browser maintenance, data wipes, or device changes
- **Export Regularly**: Use the export feature to back up your data or enable server sync for automatic backup
- **No Financial Advice**: This is a budget tracking tool only. It does not provide financial advice or recommendations
- **Use At Your Own Risk**: Always maintain backups of important financial data. The developers are not responsible for data loss

## Support

For issues, feature requests, or questions, please open an issue on GitHub.

---

**⚠️ Important**: User accounts are stored as JSON in browser localStorage (or server if sync enabled). CSV format is only used for exports and bundled example files. Always export backups of your transaction data regularly.