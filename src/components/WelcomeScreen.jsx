/**
 * Welcome screen component for the budget app.
 * Displays project overview, feature highlights, and quick navigation to main screens.
 * @param {Object} props
 * @param {Function} props.onNavigate - Callback function to navigate to a specific screen
 */
function WelcomeScreen({ onNavigate }) {
  return (
    <div className="screen-card">
      <header className="screen-header">
        <h1 className="screen-title">Welcome to your Budget App sandbox</h1>
        <p className="screen-subtitle">
          Manage your accounts, track transactions, and keep tabs on the roadmap as the product evolves.
        </p>
        <div className="screen-actions">
          <button type="button" className="primary-cta" onClick={() => onNavigate('accounts')}>
            Open Account Manager
          </button>
          <button type="button" className="secondary-cta" onClick={() => onNavigate('sheets-setup')}>
            Setup Google Sheets
          </button>
          <button type="button" className="secondary-cta" onClick={() => onNavigate('todo')}>
            View To-Do List
          </button>
        </div>
      </header>
      <section className="feature-grid">
        <article className="feature-tile">
          <h3>Dual Storage Options</h3>
          <p>
            Choose between browser localStorage for quick access or server storage for cross-device sync. Create, rename, delete, and move accounts between storage locations with full export functionality.
          </p>
        </article>
        <article className="feature-tile">
          <h3>Google Sheets Integration</h3>
          <p>Connect to live Google Sheets as read-only data sources. Maintain transactions in your spreadsheet and refresh in-app to view the latest data. One-click setup wizard handles all configuration.</p>
        </article>
        <article className="feature-tile">
          <h3>Data Security First</h3>
          <p>Server backup keeps your financial data safe across devices and browser wipes. Export all accounts as CSV with one click, track localStorage usage, and get clear warnings about data volatility.</p>
        </article>
        <article className="feature-tile">
          <h3>Next Steps</h3>
          <p>Guided transaction entry forms with split support, inline editing for existing transactions, and interactive charts to visualize spending patterns over time.</p>
        </article>
      </section>
    </div>
  );
}

export default WelcomeScreen;
