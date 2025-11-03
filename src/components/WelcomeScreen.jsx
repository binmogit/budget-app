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
          Explore the CSV explorer, keep tabs on the roadmap, and get a feel for where the product is headed.
        </p>
        <div className="screen-actions">
          <button type="button" className="primary-cta" onClick={() => onNavigate('csv')}>
            Open CSV Explorer
          </button>
          <button type="button" className="secondary-cta" onClick={() => onNavigate('todo')}>
            View To-Do List
          </button>
        </div>
      </header>
      <section className="feature-grid">
        <article className="feature-tile">
          <h3>localStorage Transactions</h3>
          <p>
            Create and manage transaction accounts directly in your browser. Data persists across sessions, with export functionality to back up your financial records as CSV files.
          </p>
        </article>
        <article className="feature-tile">
          <h3>Data Security First</h3>
          <p>Clear warnings about browser storage limitations, one-click export for all accounts, and storage usage tracking ensure your financial data stays safe.</p>
        </article>
        <article className="feature-tile">
          <h3>Next Steps</h3>
          <p>Server-side backup for cross-device sync, guided transaction entry forms with split support, and interactive charts to visualize spending patterns.</p>
        </article>
      </section>
    </div>
  );
}

export default WelcomeScreen;
