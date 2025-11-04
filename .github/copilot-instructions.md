**Budget App**
- Single-page React app via Vite; entry is src/main.jsx mounting App.jsx under StrictMode.
- App.jsx manages menu-driven navigation and renders screen components based on activeScreen state.
- Each screen is a separate component in src/components (WelcomeScreen, TodoList, AccountManager); to add a new screen, create the component, import it in App.jsx, add a menu item with a target ID, and add a case to the renderActiveScreen switch statement.
- Screens are self-contained cards; reuse screen-card and welcome/todo classes for consistent layout.
- TODO_ITEMS and STATUS_TONE constants live in TodoList.jsx; keep new status labels mapped to CSS tokens before rendering.
- WelcomeScreen.jsx contains feature highlights that should be updated when major functionality changes; keep feature descriptions aligned with current capabilities and roadmap.

**UI/UX Standards (CRITICAL)**
- **NO BROWSER ALERTS**: Never use `alert()`, `prompt()`, or `confirm()` in production code. Use Toast.jsx for notifications, Modal.jsx/InputDialog.jsx/ConfirmDialog.jsx for dialogs.
- All user feedback must be in-app components, not browser dialogs—this is mandatory for accessibility and UX consistency.

**Data Security & Persistence (CRITICAL PRIORITY)**
- Data security and backup are paramount—users track real financial transactions and cannot afford data loss.
- User-created accounts are stored as **JSON** in localStorage (array of transaction objects); only bundled example files and exports use CSV format.
- Server storage also uses **JSON format** (stored as `server/data/AccountName.json`).
- CSV format is used for: (1) bundled example files in src/data/, (2) export functionality for compatibility with spreadsheet apps.
- localStorage is volatile (cleared by browser data wipes, unavailable across devices/browsers).
- Server sync provides persistent backup—data survives browser wipes and server restarts.
- ALWAYS warn users about localStorage limitations; display clear warnings in UI where localStorage data is shown.
- Export functionality is essential—users must be able to download backups of all transaction data as CSV files.
- Never implement features that could silently lose or corrupt transaction data; validate all write operations.
- When working with transaction data, prioritize data integrity over convenience or UI polish.

**Account Manager**
- AccountManager.jsx orchestrates the account management system, combining AccountNavigator and TransactionViewer components.
- AccountNavigator.jsx handles the left sidebar: account list, create/rename/delete/move operations, storage stats, and server status display.
- CreateAccountDialog.jsx provides options for creating new accounts: manual creation (empty or with sample) or CSV import.
- CSV import functionality uses intelligent format detection based on column headers—automatically handles both Amount-based and Debit/Credit-based CSV formats.
- CSV importer detects format by checking headers: if "Amount" column exists, uses it directly; if "Debit" and "Credit" columns exist, merges them (Debit→negative, Credit→positive).
- CSV import validates and normalizes dates using date-fns library—parses common formats (DD/MM/YYYY, MM/DD/YYYY, ISO 8601, verbose) and converts ALL dates to YYYY-MM-DD.
- CSV import includes date format selector—users can choose DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, or auto-detect to resolve ambiguous dates like "03/04/2025".
- Date validation rejects transactions with unparseable dates and shows detailed error messages indicating which rows failed and why.
- Future CSV import enhancements will add support for additional bank formats and split transaction detection from extra columns.
- Advanced CSV column mapping (planned) will let users manually map imported CSV columns to JSON fields and detect split transactions from additional columns.
- TransactionViewer.jsx handles the right panel: transaction table display, inline editing mode, and save/cancel operations.
- handleAccountSelection fetches account data, parses with Papa.parse (skipEmptyLines:'greedy'), and caches results in parsedCacheRef to avoid refetch.
- formatSize displays byte estimates using response headers; call setAccounts to persist sizes so the list updates reactively.
- User-created transactions are stored as **JSON** in localStorage (via transactionStorage.js) and displayed as CSV tables in the UI.
- When server sync is enabled, JSON data is automatically backed up to server (stored as `server/data/AccountName.json`).
- File source badges: 💾 JSON (localStorage), ☁️ JSON (Server).
- localStorage files show storage usage stats and prominent warnings about data volatility.
- Export functionality converts JSON transaction data to multi-row CSV format for backup or migration.
- Server sync shows online/offline status; when offline, data only saves to localStorage.
- User notifications use Toast.jsx component (never browser alerts)—errors, warnings, and info messages appear as dismissible toasts.

**CSV Transaction Format**
- **Storage Format**: User accounts stored as JSON (array of objects with Date, TransactionID, Description, Category, Amount properties).
- **Date Format**: All dates MUST be stored as YYYY-MM-DD (ISO 8601 date format) for consistency, sortability, and analytics compatibility.
- **Export Format**: Multi-row CSV where each transaction gets one row per category allocation, linked by TransactionID.
- **Import Format**: CSV importer intelligently detects format based on headers—supports both Amount-based and Debit/Credit-based formats.
- CSV format used for: (1) bundled example files, (2) export functionality for spreadsheet compatibility, (3) import when creating accounts.
- Import detection logic: checks for "Amount" column OR both "Debit"+"Credit" columns; transforms Debit/Credit to Amount (Debit→negative, Credit→positive).
- Import date validation: uses date-fns to parse various date formats (DD/MM/YYYY, MM/DD/YYYY, ISO 8601, verbose strings) and normalizes ALL dates to YYYY-MM-DD before storage.
- Date parsing handles: ISO 8601 (2025-11-04), AU/UK format (04/11/2025), US format (11/04/2025), verbose strings (August 19 1975), and timestamps.
- Invalid dates are flagged with specific error messages; transactions with unparseable dates are rejected during import.
- Required columns for import: Date, TransactionID, Description, Category, and either Amount OR (Debit AND Credit).
- Split transactions share the same Date, TransactionID, and Description but differ in Category and Amount.
- Example split: a $6.79 grocery purchase covering both Food ($3.80) and TobAlc ($2.99) becomes two rows with TransactionID=1.
- Categories are user-defined and completely dynamic—any value in the Category column is valid.
- Income categories typically have positive amounts; expenses and transfers are negative.
- TransactionIDs are entered manually for now; auto-generation will be added after storage layer is stable.
- Server stores accounts as JSON files in server/data/ directory (one file per account).

**Styling**
- All CSS lives in src/index.css—no component-level CSS files; keep styles minimal (layout, typography, basic borders only).
- Avoid decorative effects: no border-radius, box-shadows, transitions, transforms, or gradient overlays.
- Use CSS variables (--bg-primary, --bg-surface, --bg-elevated, --border, --text-primary, --text-secondary, --accent) for theming.
- Follow existing class patterns (.screen-card, .feature-tile, .todo-item, etc.) and only add new rules when absolutely necessary.
- Responsive breakpoints: 960px (tablet) and 640px (mobile); adjust padding and flex-direction as needed.

**Workflows**
- Install dependencies with npm install (Node 18+ recommended for Vite 7) and launch the sandbox via npm run dev.
- Run npm run build to produce optimized assets in dist; preview production output locally with npm run preview.
- Lint JSX/JS files with npm run lint; pass -- --fix when safe to auto-resolve formatting and hook rule violations.

**Conventions**
- Prefer hooks and local component state; no global store present—follow the pattern in screen components (WelcomeScreen, TodoList, AccountManager).
- Keep new constants in ALL_CAPS if they may remain unused during prototyping; eslint.config.js marks capitalized variables as ignorable for no-unused-vars.
- Use fetch-compatible APIs when loading local assets; AccountManager caches via Map keyed by parsedCacheRef.
- Export default function components to stay consistent with existing modules.
- Place screen components in src/components; place shared utilities in src/utils with relative imports (e.g., ../utils/foo.js).
- **CRITICAL: NEVER use browser alerts, prompts, or confirms (alert(), prompt(), confirm()) in production code.** Always design proper in-app UI components for user interactions. Use Modal.jsx, InputDialog.jsx, ConfirmDialog.jsx for dialogs, and Toast.jsx for notifications. Browser alerts break the user experience and are not accessible. The only acceptable use is for temporary debugging during development.
- Button styling: use .button-primary (accent background), .button-secondary (transparent), and .button-danger (red, for destructive actions like delete).

**Documentation**
- Use JSDoc comments for all exported functions, components, and utility helpers to improve IntelliSense and maintainability.
- Document React components with @param tags for props; use object destructuring syntax like @param {Object} props, then list each prop separately.
- Include @returns tags for non-component functions; specify return type and describe what the function produces.
- Add @example blocks for complex utilities or non-obvious usage patterns to demonstrate correct invocation.
- Keep descriptions concise (one-liner preferred); explain the "why" when behavior isn't obvious from the function name.
- Document constants and configuration objects (TODO_ITEMS, STATUS_TONE, etc.) with block comments explaining their purpose and structure.
- README.md serves as the project's public face; update feature lists, installation steps, and roadmap when major changes occur to keep it aligned with actual capabilities.

**GitHub Readiness**
- Project uses MIT License (most permissive open-source license) - see LICENSE file.
- .gitignore excludes node_modules, dist, build artifacts, editor configs, and CSV files in src/data (user data should never be committed).
- README.md follows GitHub conventions with badges, installation instructions, usage examples, and contribution guidelines.
- Keep dependencies updated and avoid adding unnecessary packages; justify new dependencies in PR/commit messages.
- Maintain clean commit history; use descriptive messages that explain the "why" behind changes.
- Before releasing, run `npm run build` and `npm run lint` to ensure production bundle is error-free.

**Future Hooks**
- package.json includes @google-cloud/local-auth and @googleapis/drive for upcoming Drive import flows; consult product owners before pruning.
- Chart.js (via react-chartjs-2) is the chosen library for data visualization; initial focus is stacked charts showing account balances over time.
- JSZip is used for creating ZIP archives when exporting all localStorage accounts as a single compressed file.
- Express + CORS provide REST API for server-side JSON storage; see server/index.js for endpoint documentation.
- src/utils contains transactionStorage.js (localStorage) and serverApi.js (API client); add shared helpers there and import with relative paths.
- Server-side storage implemented—accounts stored as JSON files in server/data/ (git-ignored).
- Transaction entry forms with split support and TransactionID auto-generation are planned.
- Password protection/authentication for server is a planned enhancement before public deployment.
- Keep instructions updated as menu targets, data formats, or storage integrations evolve; document non-obvious patterns here.

**Project Priorities**
1. **Data Security & Backup** - Export functionality, clear warnings, data integrity validation
2. **Transaction Entry** - Guided forms for creating/editing transactions with split support
3. **Data Visualization** - Charts and insights once core data management is stable
4. **Server Integration** - Backend storage and sync for cross-device access

---

**Note:** These instructions are evolving as the project scope expands. Update this document when introducing new patterns, architectural decisions, or workflow changes to keep guidance current and consistent.
