import { useEffect, useState } from 'react';
import AccountManager from './components/AccountManager';
import TodoList from './components/TodoList';
import WelcomeScreen from './components/WelcomeScreen';
import SheetsSetupScreen from './components/SheetsSetupScreen';

/**
 * Main application component managing menu navigation and screen rendering.
 * Displays a menubar with File, Edit, View, To-Do, and Help menus.
 */
function App() {
  const [openMenu, setOpenMenu] = useState(null);
  const [activeScreen, setActiveScreen] = useState('welcome');

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMenu !== null && !event.target.closest('.menubar')) {
        setOpenMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenu]);

  const menuItems = [
    {
      label: 'File',
      items: [
        { label: 'New Budget…', disabled: true },
        { label: 'Open…', disabled: true },
        { label: 'Save', disabled: true },
        null,
        { label: 'Exit', disabled: true }
      ]
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', disabled: true },
        { label: 'Redo', disabled: true },
        null,
        { label: 'Cut', disabled: true },
        { label: 'Copy', disabled: true },
        { label: 'Paste', disabled: true }
      ]
    },
    {
      label: 'View',
      items: [
        { label: 'Welcome Screen', target: 'welcome', description: 'Overview of the project and quick shortcuts.' },
        { label: 'Account Manager', target: 'accounts', description: 'Manage accounts and view/edit transactions.' },
        null,
        { label: 'Google Sheets Setup', target: 'sheets-setup', description: 'Configure Google Sheets integration.' }
      ]
    },
    {
      label: 'To-Do',
      items: [
        { label: 'Open To-Do List', target: 'todo', description: 'Track the current work items for the budget app.' },
        null,
        { label: 'Add New Task…', disabled: true }
      ]
    },
    {
      label: 'Help',
      items: [
        { label: 'Documentation', disabled: true },
        { label: 'About', disabled: true }
      ]
    }
  ];

  const handleMenuItemSelect = (item) => {
    if (!item || item.disabled) {
      return;
    }

    if (item.target) {
      setActiveScreen(item.target);
    }

    if (typeof item.action === 'function') {
      item.action();
    }

    setOpenMenu(null);
  };

  const renderActiveScreen = () => {
    switch (activeScreen) {
      case 'accounts':
        return <AccountManager />;
      case 'todo':
        return <TodoList />;
      case 'sheets-setup':
        return <SheetsSetupScreen />;
      case 'welcome':
      default:
        return <WelcomeScreen onNavigate={setActiveScreen} />;
    }
  };

  return (
    <>
      <nav className="menubar" onMouseLeave={() => setOpenMenu(null)}>
        {menuItems.map((menu, menuIndex) => (
          <div
            className={`menu-item ${openMenu === menuIndex ? 'open' : ''}`}
            key={menu.label}
          >
            <div
              className="menu-label"
              onClick={() => setOpenMenu(openMenu === menuIndex ? null : menuIndex)}
              onMouseEnter={() => {
                // Only open on hover if another menu is already open
                if (openMenu !== null && openMenu !== menuIndex) {
                  setOpenMenu(menuIndex);
                }
              }}
            >
              {menu.label}
            </div>
            {openMenu === menuIndex && (
              <div className="dropdown">
                {menu.items.map((rawItem, itemIndex) => {
                  if (rawItem === null) {
                    return <hr key={`${menu.label}-divider-${itemIndex}`} className="divider" />;
                  }

                  const item = typeof rawItem === 'string' ? { label: rawItem, disabled: true } : rawItem;
                  const isActive = Boolean(item.target && item.target === activeScreen);

                  return (
                    <button
                      key={`${menu.label}-item-${item.label}-${itemIndex}`}
                      type="button"
                      className={`dropdown-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleMenuItemSelect(item)}
                      disabled={item.disabled}
                    >
                      <span className="dropdown-item-label">{item.label}</span>
                      {item.description && <span className="dropdown-item-description">{item.description}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      <main className="content">{renderActiveScreen()}</main>
    </>
  );
}

export default App;