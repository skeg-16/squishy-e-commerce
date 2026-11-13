import { useCallback, useEffect, useState } from 'react';
import { adminApi, errorText } from '../../services/adminService';
import { adminPreviewApi } from '../../services/adminPreviewService';
import { invalidateApiCache } from '../../services/api';
import { AdminDialog, AdminToast } from '../../components/AdminComponents';
import AdminViews from './AdminViews';
import '../../styles/admin.css';

const PREVIEW_ADMIN_PASSWORD = 'squishy-admin';
const PREVIEW_MODE = false;

const TABS = [
  ['dashboard', 'Dashboard'],
  ['orders', 'Orders'],
  ['products', 'Products'],
  ['vouchers', 'Vouchers'],
  ['reviews', 'Reviews'],
  ['users', 'Users'],
];

function getStorefrontUrl() {
  if (typeof window !== 'undefined' && window.location.port === '5174') {
    return `${window.location.protocol}//${window.location.hostname}:5173/`;
  }
  return '/';
}

function getCurrentTab() {
  const tab = window.location.hash.slice(1);
  return TABS.some(([id]) => id === tab) ? tab : 'dashboard';
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [checking, setChecking] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState(getCurrentTab);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (PREVIEW_MODE) {
      setChecking(false);
      return;
    }

    let active = true;

    async function checkSession() {
      try {
        const session = await adminApi('/session', { forceRefresh: true });

        if (!active) return;

        setDemoMode(Boolean(session.demoMode));
        if (session.authenticated) {
          setAuthenticated(true);
          setAdminUser(session.admin || null);
        } else if (!session.configured) {
          setLoginError(
            'Admin is not configured. Set ADMIN_PASSWORD (at least 8 characters) or create an admin user account.'
          );
        }
      } catch (error) {
        if (active) setLoginError(errorText(error));
      } finally {
        if (active) setChecking(false);
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleHashChange() {
      setActiveTab(getCurrentTab());
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const request = useCallback(async (path, options) => {
    if (PREVIEW_MODE) {
      return adminPreviewApi(path, options);
    }

    try {
      const result = await adminApi(path, options);
      if (options?.method && options.method !== 'GET') {
        invalidateApiCache();
      }
      return result;
    } catch (error) {
      if (error.status === 401) {
        setAuthenticated(false);
        setAdminUser(null);
        setPassword('');
        setLoginError('Your admin session has expired. Please log in again.');
      }
      throw error;
    }
  }, []);

  function handleLogin(event) {
    event.preventDefault();
    setLoginError('');

    if (PREVIEW_MODE) {
      if (password === PREVIEW_ADMIN_PASSWORD) {
        setPassword('');
        setAuthenticated(true);
        setRefreshKey((value) => value + 1);
      } else {
        setLoginError('Incorrect admin password. Please try again.');
      }
      return;
    }

    const payload = identifier.trim()
      ? { identifier: identifier.trim(), password }
      : { password };

    adminApi('/login', {
      method: 'POST',
      body: payload,
    })
      .then((data) => {
        setPassword('');
        setAuthenticated(true);
        setAdminUser(data?.admin || null);
        if (typeof data?.demoMode === 'boolean') {
          setDemoMode(data.demoMode);
        }
        setRefreshKey((value) => value + 1);
      })
      .catch((error) => setLoginError(errorText(error)));
  }

  async function handleLogout() {
    if (!PREVIEW_MODE) {
      try {
        await adminApi('/logout', { method: 'POST' });
      } catch {
        // Still return to the login screen if logout fails.
      }
    }

    setAuthenticated(false);
    setAdminUser(null);
    setPassword('');
    setLoginError('');
    setDialog(null);
    setToast(null);
  }

  function openDialog(title, content) {
    if (typeof title === 'object' && title !== null) {
      setDialog(title);
    } else {
      setDialog({ title, content });
    }
  }

  function closeDialog() {
    setDialog(null);
  }

  function showToast(message, type = 'success') {
    const normalizedType = type === true ? 'error' : type || 'success';
    setToast({ message, type: normalizedType });
  }

  function dismissToast() {
    setToast(null);
  }

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  if (checking) {
    return (
      <main className="ad-login">
        <p>Checking admin session...</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="ad-login">
        <form className="ad-card ad-login__card" onSubmit={handleLogin}>
          <h1>Squishies Admin</h1>
          <p>Sign in to manage your store, inventory, orders, and users.</p>

          <label className="ad-field" htmlFor="admin-identifier">
            <span>Admin Username or Email (optional)</span>
            <input
              id="admin-identifier"
              type="text"
              placeholder="Leave blank to use master password"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
            />
          </label>

          <label className="ad-field" htmlFor="admin-password">
            <span>Password</span>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            {demoMode && (
              <small>
                Demo mode active: master password is <code>squishy-admin</code>
              </small>
            )}
          </label>

          {loginError && (
            <p className="ad-error" role="alert">{loginError}</p>
          )}

          <button className="btn btn--pink" type="submit">
            Log in
          </button>

          <a href={getStorefrontUrl()}>Back to store</a>
        </form>
      </main>
    );
  }

  const currentTab = TABS.find(([id]) => id === activeTab) || TABS[0];

  return (
    <div className="ad-app">
      <header className="ad-header">
        <a href={getStorefrontUrl()} className="ad-brand">
          Squishies Admin
          {adminUser?.username && <small>@{adminUser.username}</small>}
        </a>

        <nav className="ad-tabs" aria-label="Admin navigation">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`ad-tab ${activeTab === id ? 'active' : ''}`}
              aria-current={activeTab === id ? 'page' : undefined}
              onClick={() => {
                window.location.hash = id;
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="ad-header-actions">
          <a
            className="btn btn--outline btn--sm"
            href={getStorefrontUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            View store
          </a>
          <button
            className="btn btn--outline btn--sm"
            type="button"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <main className="ad-main">
        <h1 className="ad-page-title">{currentTab[1]}</h1>

        <AdminViews
          activeTab={activeTab}
          request={request}
          refreshKey={refreshKey}
          refresh={refresh}
          openDialog={openDialog}
          closeDialog={closeDialog}
          showToast={showToast}
          adminUser={adminUser}
        />
      </main>

      <AdminDialog dialog={dialog} onClose={closeDialog} />
      <AdminToast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
