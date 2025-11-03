/**
 * Product roadmap items displayed in the To-Do dashboard.
 * Each item includes id, title, description, status, and owner.
 */
const TODO_ITEMS = [
  {
    id: 'transaction-entry-tools',
    title: 'Build transaction entry tools',
    description: 'Create guided forms for adding new transactions with split support and validation. TransactionID auto-generation will be added after localStorage is stable.',
    status: 'Planned',
    owner: 'Data Entry'
  },
  {
    id: 'csv-inline-editing',
    title: 'Enable inline CSV editing',
    description: 'Allow editing existing transactions directly from the CSV preview table with validation. Now that persistent storage (localStorage and server) is implemented, this can proceed.',
    status: 'Planned',
    owner: 'Data Entry'
  },
  {
    id: 'interactive-graphs',
    title: 'Prototype interactive spend graphs',
    description: 'Build stacked charts using Chart.js (react-chartjs-2) to show account balances over time, with each account layered to display the total. Focus on time-series visualization and category distribution.',
    status: 'Planned',
    owner: 'Analytics'
  },
  {
    id: 'design-budget-ui',
    title: 'Design budget allocation workspace',
    description: 'Create views for category-level budgets, monthly envelopes, and quick adjustments.',
    status: 'Planned',
    owner: 'Product Design'
  },
  {
    id: 'categorisation-rules',
    title: 'Build transaction categorisation rules',
    description: 'Allow users to define rules that auto-tag transactions based on merchant and description.',
    status: 'Planned',
    owner: 'Automation'
  },
  {
    id: 'reporting-dashboard',
    title: 'Prototype insights dashboard',
    description: 'Summarise spend vs budget, burn rate, and forecasted cash flow in one place.',
    status: 'Blocked',
    owner: 'Analytics'
  }
];

/**
 * Maps todo status strings to CSS class names for styling status pills.
 */
const STATUS_TONE = {
  'In Progress': 'status-progress',
  Planned: 'status-planned',
  Blocked: 'status-blocked'
};

/**
 * Product to-do list screen displaying roadmap items with status indicators.
 * Shows planned features, work in progress, and blocked items for the budget app.
 */
function TodoList() {
  return (
    <div className="screen-card">
      <header className="screen-header">
        <h1 className="screen-title">Product To-Do</h1>
        <p className="screen-subtitle">The concrete work we still need before the budget app is feature complete.</p>
      </header>
      <ul className="todo-list">
        {TODO_ITEMS.map((task) => (
          <li key={task.id} className="todo-item">
            <div className="todo-content">
              <h2 className="todo-title">{task.title}</h2>
              <p className="todo-description">{task.description}</p>
              <div className="todo-meta">
                <span className="todo-owner">Owner: {task.owner}</span>
              </div>
            </div>
            <span className={`status-pill ${STATUS_TONE[task.status] ?? ''}`}>{task.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TodoList;
