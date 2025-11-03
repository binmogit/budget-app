**Budget App**
- Single-page React app via Vite; entry is src/main.jsx mounting App.jsx under StrictMode.
- App.jsx manages menu-driven navigation and renders screen components based on activeScreen state.
- Each screen is a separate component in src/components (WelcomeScreen, TodoList, CsvViewer); to add a new screen, create the component, import it in App.jsx, add a menu item with a target ID, and add a case to the renderActiveScreen switch statement.
- Screens are self-contained cards; reuse screen-card and welcome/todo classes for consistent layout.
- TODO_ITEMS and STATUS_TONE constants live in TodoList.jsx; keep new status labels mapped to CSS tokens before rendering.
- WelcomeScreen.jsx contains feature highlights that should be updated when major functionality changes; keep feature descriptions aligned with current capabilities and roadmap.

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

**CSV Explorer**
- CsvViewer.jsx auto-discovers CSV files placed in src/data using import.meta.glob('../data/**/*.csv', {as:'url', eager:true}).
- handleFileSelection fetches the file URL, parses with Papa.parse (skipEmptyLines:'greedy'), and caches results in parsedCacheRef to avoid refetch.
- formatSize displays byte estimates using response headers; call setFiles to persist sizes so the list updates reactively.
- For new CSV helpers, update parseCSV to normalize rows or extend the headers/rows pair expected by the table renderer.
- User-created transactions are stored as **JSON** in localStorage (via transactionStorage.js) and displayed as CSV tables in the UI.
- When server sync is enabled, JSON data is automatically backed up to server (stored as `server/data/AccountName.json`).
- Bundled CSV files (e.g., Example.csv) in src/data are actual CSV text files—these are legacy examples.
- CsvViewer displays file source badges: � JSON (localStorage), ☁️ JSON (Server), or 📁 CSV (Bundled).
- localStorage files show storage usage stats and prominent warnings about data volatility.
- Export functionality converts JSON transaction data to multi-row CSV format for backup or migration.
- Server sync toggle shows online/offline status; when offline, data only saves to localStorage.

**CSV Transaction Format**
- **Storage Format**: User accounts stored as JSON (array of objects with Date, TransactionID, Description, Category, Amount properties).
- **Export Format**: Multi-row CSV where each transaction gets one row per category allocation, linked by TransactionID.
- CSV format used for: (1) bundled example files, (2) export functionality for spreadsheet compatibility.
- Required columns: Date, TransactionID, Description, Category, Amount.
- Split transactions share the same Date, TransactionID, and Description but differ in Category and Amount.
- Example split: a $6.79 grocery purchase covering both Food ($3.80) and TobAlc ($2.99) becomes two rows with TransactionID=1.
- Categories span incomes (Gov, Work, Interest, Dividends), account transfers (Cash, NAB, ING, CommSec, etc.), and expenses (Food, Retail, Rent, Health, etc.).
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
- Vite serves CSV assets from src/data during dev/build; restarting the dev server reloads glob imports when files are added or renamed.

**Conventions**
- Prefer hooks and local component state; no global store present—follow the pattern in screen components (WelcomeScreen, TodoList, CsvViewer).
- Keep new constants in ALL_CAPS if they may remain unused during prototyping; eslint.config.js marks capitalized variables as ignorable for no-unused-vars.
- Use fetch-compatible APIs when loading local assets; CsvViewer caches via Map keyed by import.meta.glob IDs.
- Export default function components to stay consistent with existing modules.
- Place screen components in src/components; place shared utilities in src/utils with relative imports (e.g., ../utils/foo.js).
- Avoid browser alerts, prompts, and confirms (alert(), prompt(), confirm()) outside of debugging; design in-app UI elements for user interactions like confirmations and text input instead.
- Use Modal.jsx, InputDialog.jsx, and ConfirmDialog.jsx for user interactions requiring dialogs; these maintain consistent styling and behavior.
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
- src/utils contains transactionStorage.js (localStorage + server sync) and serverApi.js (API client); add shared helpers there and import with relative paths.
- CSV files in src/data are git-ignored; these are legacy examples—primary storage is JSON (localStorage/server).
- Server-side storage implemented—accounts stored as JSON files in server/data/ (git-ignored).
- Transaction entry forms with split support and TransactionID auto-generation are planned after server storage is stable.
- Password protection/authentication for server is a planned enhancement before public deployment.
- Keep instructions updated as menu targets, data formats, or storage integrations evolve; document non-obvious patterns here.

**Project Priorities**
1. **Data Security & Backup** - Export functionality, clear warnings, data integrity validation
2. **Transaction Entry** - Guided forms for creating/editing transactions with split support
3. **Data Visualization** - Charts and insights once core data management is stable
4. **Server Integration** - Backend storage and sync for cross-device access

---

**Note:** These instructions are evolving as the project scope expands. Update this document when introducing new patterns, architectural decisions, or workflow changes to keep guidance current and consistent.
