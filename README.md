# Budget App

A lightweight personal finance tracker built with React and Vite. Manage transactions across multiple accounts with intelligent CSV import, export backups, and optional server sync—no complex setup required.

## Features

- **Multi-Account Management** - Create and organize multiple account ledgers (checking, savings, credit cards)
- **Smart CSV Import** - Automatically detects and transforms CSV formats (Amount-based or Debit/Credit columns)
- **Flexible Storage** - Choose between browser localStorage or server-side JSON storage for each account
- **Export & Backup** - Download individual accounts as CSV or export all data as a ZIP archive
- **Split Transactions** - Track expenses across multiple categories with linked TransactionIDs

## Installation

### Prerequisites
- Node.js 18+
- Modern browser with localStorage support

### Quick Start

```bash
# Clone and install
git clone https://github.com/binmogit/budget-app.git
cd budget-app
npm install

# Start development server (frontend only)
npm run dev

# OR start with backend server for persistent storage
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
4. Select storage: **💾 Browser** (localStorage) or **☁️ Server** (persistent)

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

⚠️ **Browser storage is volatile** - localStorage can be cleared by browser maintenance or device changes. Use **Export All** regularly or enable server storage for automatic backup.

**No warranty**: This tool is for personal budget tracking only. Always maintain backups of financial data.