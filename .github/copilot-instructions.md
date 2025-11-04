**Budget App**
- Single-page React app via Vite; entry is src/main.jsx mounting App.jsx under StrictMode.
- App.jsx manages menu-driven navigation and renders screen components based on activeScreen state.
- Each screen is a separate component in src/components; to add a screen: create component, import in App.jsx, add menu item, add case to renderActiveScreen switch.
- Screens use .screen-card and .welcome/.todo classes for consistent layout.
- TODO_ITEMS and STATUS_TONE constants live in TodoList.jsx.
- WelcomeScreen.jsx contains feature highlights—update when major functionality changes.

**UI/UX Standards (CRITICAL)**
- **NO BROWSER ALERTS**: Never use `alert()`, `prompt()`, or `confirm()`. Use Toast.jsx for notifications, Modal.jsx/InputDialog.jsx/ConfirmDialog.jsx for user input.
- All user feedback must be in-app components for accessibility and UX consistency.

**Data Security & Persistence (CRITICAL PRIORITY)**
- Data security is paramount—users track real financial transactions and cannot afford data loss.
- **Storage Format**: User accounts stored as JSON in localStorage (array of transaction objects); server storage mirrors this (server/data/AccountName.json).
- **CSV Usage**: Only for (1) bundled examples in src/data/, (2) export functionality, (3) import when creating accounts.
- localStorage is volatile (cleared by browser wipes, unavailable across devices); server sync provides persistent backup.

**Sync Status & Badges** (5-state system)
- **☁️ JSON (Server)** - Synced with server, server online, data matches
- **⛈️ JSON (Server - Offline)** - Synced with server but server currently offline, data cached locally
- **⚠️ Unsaved Changes** - Account exists on server but has unsaved local edits
- **💾 JSON (localStorage)** - localStorage-only, never synced to server
- **📊 Google Sheets (Read-Only)** - Live connection to Google Sheets; refreshes periodically, not editable in-app
- Badge determined by `syncedToServer`, `serverAccount`, and `googleSheetId` metadata flags, not just server account list (works even when server offline).
- `serverAccount` flag tracks whether account is associated with server; `syncedToServer` tracks current sync state.
- `googleSheetId` + `sheetName` flags track Google Sheets connection; transactions cached locally for offline viewing.

**Warning Messages by Badge Type**
- **localStorage**: Single warning - "⚠️ Data stored in browser localStorage. Export regularly to avoid data loss."
- **server**: Single note - "☁️ This account is stored on the configured server."
- **serverOffline**: Two warnings - (1) localStorage volatility warning, (2) "⚠️ Server is offline. You can sync changes when server is available."
- **conflict**: Two warnings - (1) localStorage volatility warning, (2) "⚠️ This account has unsaved local changes that need to be synced to the server."
- **googleSheet**: Two notes - (1) "📊 Live Google Sheets connection - data is read-only in this view", (2) "Last synced: [timestamp]. Click 'Refresh' to fetch latest data from sheet."
- All warnings displayed in TransactionViewer.jsx metadata section as separate boxes for clarity.

**Conflict Resolution System**
- ConflictResolutionDialog shows side-by-side comparison (transaction count, lastModified, preview) when local and server versions differ.
- Conflicts trigger in three scenarios:
  1. Saving edits to server account when server version was modified since last sync
  2. Loading account with `source === 'conflict'` badge (user clicks account with unsaved changes)
  3. Loading `serverOffline` account when server comes back online and data differs
- Conflict detection **skipped** if `syncedToServer = true` (timestamps may differ slightly from save timing, but content is trusted).
- User always chooses which version to keep—no silent overwrites.
- Metadata (lastModified, transactionCount, syncedToServer, serverAccount) stored separately in localStorage for efficient conflict detection.
- `serverAccount` flag: true if account is associated with server (created on server or moved to server), false for localStorage-only accounts.
- `syncedToServer` flag: true if current local data matches server, false if unsaved local changes exist.
- Server endpoint `/api/accounts/:name/metadata` provides metadata without downloading full transaction data.

**Sync Status Workflow**
- Creating server account: mark `syncedToServer = true` after successful server save
- Loading from server: save to localStorage with `syncedToServer = true`
- User edits: mark `syncedToServer = false`, badge becomes "⚠️ Unsaved Changes"
- Saving to server succeeds: mark `syncedToServer = true`, badge returns to "☁️ JSON (Server)"
- Saving to server fails: keep `syncedToServer = false`, badge stays "⚠️ Unsaved Changes"
- Server goes offline: badge changes from "☁️ JSON (Server)" to "⛈️ JSON (Server - Offline)" based on syncedToServer flag
- Moving account to/from server: update syncedToServer accordingly

- Export functionality essential—users must be able to download CSV backups of all transaction data.
- ALWAYS warn users about localStorage volatility; display warnings where localStorage data is shown.
- Never implement features that could silently lose or corrupt data; validate all write operations.
- Prioritize data integrity over convenience or UI polish.

**Account Manager Components**
- AccountManager.jsx orchestrates account management, combining AccountNavigator (sidebar) and TransactionViewer (main panel).
- AccountNavigator.jsx: account list, create/rename/delete/move operations, storage stats, server status display.
- TransactionViewer.jsx: transaction table, inline editing mode, save/cancel operations. Read-only mode for Google Sheets accounts.
- CreateAccountDialog.jsx: manual creation (empty/sample), CSV import with intelligent format detection, or Google Sheets connection.
- ConflictResolutionDialog.jsx: side-by-side comparison UI when local and server data conflicts arise.

**Google Sheets Integration (Read-Only)**
- Users can connect to a Google Sheets sheet by providing Sheet ID and sheet name (or full URL).
- Initial connection fetches and validates data through same CSV import logic (date normalization, column detection).
- Transactions cached locally in localStorage for offline viewing; badge shows 📊 Google Sheets (Read-Only).
- Periodic refresh (manual or automatic) fetches latest data from sheet via Google Sheets API.
- Backend server proxies API calls to keep OAuth credentials secure; frontend never touches credentials.
- Google Sheets accounts are NOT editable in-app—users make all changes in the Google Sheet itself.
- Metadata includes `googleSheetId`, `sheetName`, `lastSync` timestamp, `syncInterval` preference.
- Export functionality works same as other accounts—generates CSV from cached transaction data.
- Moving to localStorage creates editable copy; original sheet connection is removed.
- API client: sheetsApi.js (fetchSheetData, validateSheetFormat, refreshSheetData).
- Server endpoint: `/api/sheets/fetch` accepts Sheet ID + sheet name, returns JSON transaction array.
- **Setup Requirements**: 
  1. Google Cloud project with Google Sheets API enabled (CRITICAL - causes 403 errors if missing)
  2. Service account credentials uploaded to `server/credentials.json`
  3. Google Sheet shared with service account email (from credentials.json `client_email`)
- Common errors: "403 Permission Denied" = API not enabled in Google Cloud; "Sheet not found" = not shared with service account

**CSV Import Features**
- Intelligent format detection: handles Amount-based OR Debit/Credit-based formats.
- Detection logic: if "Amount" column exists, use it; if "Debit" + "Credit" exist, merge (Debit→negative, Credit→positive).
- Date normalization: parses DD/MM/YYYY, MM/DD/YYYY, ISO 8601, verbose formats → converts ALL to YYYY-MM-DD for storage.
- Date format selector: user chooses DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, or auto-detect for ambiguous dates.
- Validation: rejects unparseable dates with detailed error messages showing which rows failed.
- Required columns: Date, TransactionID, Description, Category, and (Amount OR Debit+Credit).
- Future enhancements: advanced column mapping, additional bank formats, split transaction detection from extra columns.

**Transaction Data Model**
- Storage: JSON array of objects with Date, TransactionID, Description, Category, Amount properties.
- Date format: YYYY-MM-DD (ISO 8601) for consistency, sortability, analytics compatibility.
- Export: Multi-row CSV where split transactions get one row per category, linked by TransactionID.
- Split example: $6.79 grocery purchase split into Food ($3.80) and TobAlc ($2.99) = two rows, same TransactionID.
- Categories: user-defined, completely dynamic—any string is valid.
- Amount convention: positive = income, negative = expenses/transfers.
- TransactionIDs: manual entry for now; auto-generation planned.

**Key Implementation Details**
- handleAccountSelection: fetches data, parses with Papa.parse (skipEmptyLines:'greedy'), caches in parsedCacheRef.
- formatSize: displays byte estimates; update setAccounts to persist sizes for reactive list updates.
- transactionStorage.js: localStorage operations (getTransactions, saveTransactions, getAccountMetadata, markAsSynced, markAsUnsynced).
- serverApi.js: API client (fetchAccounts, fetchAccountTransactions, fetchAccountMetadata, saveAccountToServer).
- Server stores: JSON files in server/data/ directory (one file per account, git-ignored).
- Notifications: Toast.jsx only—never browser alerts.

**Styling**
- All CSS in src/index.css; no component-level CSS files.
- Minimal styles: layout, typography, basic borders only—avoid decorative effects (no border-radius, box-shadows, transitions, transforms, gradients).
- CSS variables: --bg-primary, --bg-surface, --bg-elevated, --border, --text-primary, --text-secondary, --accent.
- Follow existing patterns (.screen-card, .feature-tile, .todo-item); add new rules only when necessary.
- Responsive breakpoints: 960px (tablet), 640px (mobile).

**Development Workflows**
- Install: `npm install` (Node 18+ for Vite 7)
- Dev: `npm run dev` (starts Vite dev server)
- Build: `npm run build` (production bundle in dist/)
- Preview: `npm run preview` (test production build locally)
- Lint: `npm run lint` (add `-- --fix` to auto-fix)

**Code Conventions**
- Hooks and local component state; no global store.
- ALL_CAPS constants allowed if unused during prototyping (eslint marks as ignorable).
- Export default function components; place screens in src/components, utilities in src/utils.
- Relative imports: ../utils/foo.js
- Button styles: .button-primary (accent), .button-secondary (transparent), .button-danger (red, destructive).

**Documentation Standards**
- JSDoc all exports: functions, components, utilities.
- React components: @param {Object} props, then list each prop.
- Functions: @returns with type and description.
- @example blocks for complex/non-obvious patterns.
- Concise descriptions; explain "why" when name isn't obvious.
- Update README.md when major features change.

**GitHub & Release Readiness**
- MIT License (most permissive).
- .gitignore: node_modules, dist, build artifacts, editor configs, user data CSVs, server/data/.
- Live demo: https://binmogit.github.io/budget-app/ (localStorage-only, auto-deployed via GitHub Pages).
- Deploy to GitHub Pages: `npm run deploy` (builds and publishes to gh-pages branch).
- Production builds use .env.production to disable server API calls (prevents localhost connection attempts).
- Run `npm run build && npm run lint` before major releases.
- Clean commit messages explaining "why" behind changes.

**Dependencies & Future Features**
- @google-cloud/local-auth, @googleapis/drive: OAuth flow for Google Sheets integration (in progress).
- @googleapis/sheets: Google Sheets API client (install via `npm install @googleapis/sheets`).
- react-chartjs-2: data visualization (stacked balance charts planned).
- JSZip: multi-account export as ZIP.
- Express + CORS: REST API for JSON storage (server/index.js) and Google Sheets proxy.
- Planned: transaction entry forms, split support, TransactionID auto-generation, server authentication, Google Sheets auto-refresh.

**Project Priorities**
1. **Data Security & Backup** - Export, warnings, validation
2. **Google Sheets Integration** - Read-only live feed from Google Sheets
3. **Transaction Entry** - Forms with split support (for non-Sheets accounts)
4. **Data Visualization** - Charts and insights
5. **Server Integration** - Cross-device sync and Google Sheets OAuth proxy
