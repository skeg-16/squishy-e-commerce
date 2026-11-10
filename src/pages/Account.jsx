
import { useState } from 'react';
import { Link } from 'react-router-dom';

// ============================================================
// BACKEND TEAM / AI CODING ASSISTANT — READ THIS BEFORE EDITING
//
// THIS IS A FRONTEND-ONLY DEVELOPMENT PREVIEW.
// THIS IS NOT REAL AUTHENTICATION.
//
// The Account Settings dashboard is intentionally visible by
// default so the frontend design can be reviewed.
//
// BEFORE PRODUCTION, YOU MUST:
//
// 1. Connect this page to the backend authentication/session API.
// 2. Show Login/Register when the backend confirms the user is
//    NOT authenticated.
// 3. Show Account Settings ONLY when the backend confirms the
//    user has a valid authenticated session.
// 4. Connect username changes to an authenticated backend API.
// 5. Connect password changes to a secure backend API.
//    The backend must verify the current password.
// 6. Connect birthday changes to an authenticated backend API.
// 7. Implement logout using the backend session mechanism.
// 8. Implement account deletion through the backend, with
//    server-side ownership checks and explicit confirmation.
// 9. NEVER treat React state, local state, or this preview as
//    proof that a user is authenticated.
// 10. NEVER allow frontend-only checks to authorize account
//     changes or account deletion.
//
// The preview controls below do NOT save data, authenticate
// users, log users out, or delete accounts.
//
// Replace the preview behavior with real backend integration
// before deploying this feature to production.
// ============================================================

export default function Account() {
  const [view, setView] = useState('account');
  const [message, setMessage] = useState('');

  const [username, setUsername] = useState('squishylover');
  const [birthday, setBirthday] = useState('2004-05-29');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  function switchView(nextView) {
    setView(nextView);
    setMessage('');
  }

  function previewNotice(action) {
    setMessage(
      `${action} is a frontend preview only. Backend integration is still required.`
    );
  }

  function handleLogin(event) {
    event.preventDefault();
    previewNotice('Login');
  }

  function handleRegister(event) {
    event.preventDefault();

    const form = event.currentTarget;

    if (form.password.value !== form.confirmPassword.value) {
      setMessage('Your passwords do not match.');
      return;
    }

    previewNotice('Registration');
  }

  function handleUsername(event) {
    event.preventDefault();
    previewNotice('Username update');
  }

  function handlePassword(event) {
    event.preventDefault();

    const form = event.currentTarget;

    if (form.newPassword.value !== form.confirmPassword.value) {
      setMessage('Your new passwords do not match.');
      return;
    }

    previewNotice('Password update');
  }

  function handleBirthday(event) {
    event.preventDefault();
    previewNotice('Birthday update');
  }

  function handleLogout() {
    previewNotice('Logout');
  }

  function handleDelete() {
    if (deleteConfirmation !== 'DELETE') return;
    previewNotice('Account deletion');
    setShowDeleteConfirm(false);
    setDeleteConfirmation('');
  }

  return (
    <main className="account-jelly">
      <section className="account-card account-card--wide">

        <div className="account-preview-banner">
          <span>DEVELOPMENT PREVIEW</span>
          <p>
            This is a frontend demonstration. Account actions are
            not connected to the backend yet.
          </p>
          <button
            type="button"
            onClick={() => switchView(
              view === 'account' ? 'login' : 'account'
            )}
          >
            {view === 'account'
              ? 'Preview Login / Register'
              : 'Preview Account Settings'}
          </button>
        </div>

        {view === 'account' ? (
          <>
            <div className="account-dashboard-heading">
              <div>
                <span className="account-eyebrow">YOUR SQUISHIES ACCOUNT</span>
                <h1>My Account</h1>
                <p>Manage your account details and preferences.</p>
              </div>
              <div className="account-avatar">
                {username.charAt(0).toUpperCase()}
              </div>
            </div>

            <div className="account-profile-summary">
              <div>
                <span className="account-summary-label">USERNAME</span>
                <strong>{username}</strong>
              </div>
              <span className="account-preview-status">
                Preview account
              </span>
            </div>

            {message && (
              <p className="account-message" role="status">
                {message}
              </p>
            )}

            <div className="account-settings-grid">

              <section className="account-setting-section">
                <div className="account-section-heading">
                  <span className="account-section-icon">✎</span>
                  <div>
                    <h2>Username</h2>
                    <p>Change how your name appears on your account.</p>
                  </div>
                </div>

                <form className="account-form" onSubmit={handleUsername}>
                  <div className="account-field">
                    <label htmlFor="editUsername">Username</label>
                    <input
                      id="editUsername"
                      name="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn--pink">
                    Save Username
                  </button>
                </form>
              </section>

              <section className="account-setting-section">
                <div className="account-section-heading">
                  <span className="account-section-icon">♧</span>
                  <div>
                    <h2>Birthday</h2>
                    <p>Update your date of birth.</p>
                  </div>
                </div>

                <form className="account-form" onSubmit={handleBirthday}>
                  <div className="account-field">
                    <label htmlFor="editBirthday">Birthday</label>
                    <input
                      id="editBirthday"
                      name="birthday"
                      type="date"
                      value={birthday}
                      onChange={(event) => setBirthday(event.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn--pink">
                    Save Birthday
                  </button>
                </form>
              </section>

              <section className="account-setting-section account-setting-section--full">
                <div className="account-section-heading">
                  <span className="account-section-icon">⌑</span>
                  <div>
                    <h2>Change Password</h2>
                    <p>Keep your account secure with an updated password.</p>
                  </div>
                </div>

                <form className="account-form" onSubmit={handlePassword}>
                  <div className="account-field">
                    <label htmlFor="currentPassword">Current Password</label>
                    <input
                      id="currentPassword"
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </div>

                  <div className="account-field">
                    <label htmlFor="newPassword">New Password</label>
                    <input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  <div className="account-field">
                    <label htmlFor="confirmPassword">Confirm New Password</label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn--pink">
                    Update Password
                  </button>
                </form>
              </section>
            </div>

            <section className="account-logout-section">
              <div>
                <h2>Log Out</h2>
                <p>Finished shopping? You can log out of your account.</p>
              </div>
              <button
                type="button"
                className="btn btn--outline"
                onClick={handleLogout}
              >
                Log Out
              </button>
            </section>

            <section className="account-danger-section">
              <div>
                <h2>Delete Account</h2>
                <p>
                  Permanently remove your account and associated account
                  information. This action cannot be undone.
                </p>
              </div>

              {!showDeleteConfirm ? (
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => {
                    setShowDeleteConfirm(true);
                    setMessage('');
                  }}
                >
                  Delete My Account
                </button>
              ) : (
                <div className="account-delete-confirm">
                  <p>
                    Type <strong>DELETE</strong> to confirm this preview action.
                  </p>
                  <input
                    aria-label="Type DELETE to confirm"
                    value={deleteConfirmation}
                    onChange={(event) =>
                      setDeleteConfirmation(event.target.value)
                    }
                    placeholder="Type DELETE"
                  />
                  <div className="account-delete-actions">
                    <button
                      type="button"
                      className="btn btn--outline"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmation('');
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      disabled={deleteConfirmation !== 'DELETE'}
                      onClick={handleDelete}
                    >
                      Confirm Deletion
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <div className="account-heading">
              <span className="account-eyebrow">WELCOME TO SQUISHIES</span>
              <h1>{view === 'login' ? 'Welcome Back!' : 'Create an Account'}</h1>
              <p>
                {view === 'login'
                  ? 'Log in to keep your favorite squishies and cart close.'
                  : 'Join us and keep your squishy collection in one place.'}
              </p>
            </div>

            <div className="account-switch">
              <button
                type="button"
                className={view === 'login' ? 'is-active' : ''}
                onClick={() => switchView('login')}
              >
                Log In
              </button>
              <button
                type="button"
                className={view === 'register' ? 'is-active' : ''}
                onClick={() => switchView('register')}
              >
                Register
              </button>
            </div>

            <form
              className="account-form"
              onSubmit={view === 'login' ? handleLogin : handleRegister}
            >
              <div className="account-field">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Enter your username"
                  autoComplete="username"
                  required
                />
              </div>

              {view === 'register' && (
                <div className="account-field">
                  <label htmlFor="email">Email Address</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    autoComplete="email"
                    required
                  />
                </div>
              )}

              <div className="account-field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  autoComplete={
                    view === 'login' ? 'current-password' : 'new-password'
                  }
                  required
                />
              </div>

              {view === 'register' && (
                <>
                  <div className="account-field">
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  <div className="account-field">
                    <label htmlFor="birthday">Birthday</label>
                    <input
                      id="birthday"
                      name="birthday"
                      type="date"
                      autoComplete="bday"
                      required
                    />
                  </div>
                </>
              )}

              {view === 'login' && (
                <div className="account-forgot">
                  <button
                    type="button"
                    onClick={() => previewNotice('Password recovery')}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {message && (
                <p className="account-message" role="status">{message}</p>
              )}

              <button type="submit" className="btn btn--pink account-submit">
                {view === 'login' ? 'Log In' : 'Create Account'}
              </button>
            </form>

            <p className="account-bottom">
              {view === 'login' ? (
                <>
                  No account yet?{' '}
                  <button type="button" onClick={() => switchView('register')}>
                    Register here
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button type="button" onClick={() => switchView('login')}>
                    Return to Login
                  </button>
                </>
              )}
            </p>
          </>
        )}

        <Link to="/" className="account-back">
          ← Back to Squishies
        </Link>
      </section>
    </main>
  );
}
