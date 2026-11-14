import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SquishiesAPI } from '../services/api';
import {
  FIELD_LIMITS,
  getPasswordStrength,
  sanitizeBarangayName,
  sanitizeCityName,
  sanitizeDigits,
  sanitizeEmail,
  sanitizePersonName,
  sanitizePhPhone,
  sanitizeStreetAddress,
  sanitizeUsername,
  scrollToFirstInvalidField,
  validateProfileFields,
  validateRegisterFields,
  validateResetPasswordFields,
} from '../utils/validators';

const PH_REGIONS = [
  { value: 'metro-manila', label: 'Metro Manila' },
  { value: 'luzon', label: 'Luzon' },
  { value: 'visayas', label: 'Visayas' },
  { value: 'mindanao', label: 'Mindanao' },
];

const ORDER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'To Pay', label: 'To Pay' },
  { id: 'To Ship', label: 'To Ship' },
  { id: 'Shipped', label: 'Shipped' },
  { id: 'Completed', label: 'Completed' },
  { id: 'Cancelled', label: 'Cancelled' },
];

function formatPhp(amount) {
  const num = Number(amount || 0);
  const decimals = Number.isInteger(num) ? 0 : 2;
  return `₱${num.toLocaleString('en-PH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  })}`;
}

function EyeIcon({ visible }) {
  return visible ? (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="m1 1 22 22" />
    </svg>
  ) : (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PasswordInput({
  id,
  name,
  value,
  onChange,
  placeholder,
  autoComplete,
  required = true,
  hasError = false,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="account-input-wrap">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className={hasError ? 'is-invalid' : ''}
      />
      <button
        type="button"
        className="account-eye-btn"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        <EyeIcon visible={visible} />
      </button>
    </div>
  );
}

function PasswordStrengthMeter({ password }) {
  const strength = getPasswordStrength(password);
  if (!password) return null;

  return (
    <div className={`password-meter password-meter--${strength.tone}`}>
      <div className="password-meter__bars" aria-hidden="true">
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={
              strength.score >= bar + (bar === 4 ? 1 : 0) || (strength.score >= 2 && bar === 1)
                ? 'is-filled'
                : ''
            }
          />
        ))}
      </div>
      <div className="password-meter__meta">
        <strong>Strength: {strength.label}</strong>
        <span>
          {!strength.checks.minLength
            ? '8+ characters needed'
            : !strength.checks.hasUpper || !strength.checks.hasLower
              ? 'Add uppercase & lowercase letters'
              : !strength.checks.hasDigit
                ? 'Add at least 1 number'
                : 'Ready for your collector account'}
        </span>
      </div>
    </div>
  );
}

function statusPillTone(status) {
  switch (status) {
    case 'Completed':
      return 'is-completed';
    case 'Shipped':
      return 'is-shipped';
    case 'To Ship':
      return 'is-toship';
    case 'To Pay':
      return 'is-topay';
    case 'Cancelled':
    case 'Expired':
      return 'is-cancelled';
    default:
      return '';
  }
}

export default function Account() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, authenticated, loading, login, register, logout, setUser } = useAuth();

  const modeParam = searchParams.get('mode');
  const nextRedirect = searchParams.get('next');

  const [authTab, setAuthTab] = useState(
    modeParam === 'register' ? 'register' : modeParam === 'forgot' ? 'forgot' : 'login'
  );
  const [hubTab, setHubTab] = useState('orders');
  const [orderFilter, setOrderFilter] = useState('all');

  const [submitting, setSubmitting] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null); // { tone: 'success'|'error', text: string }
  const [fieldErrors, setFieldErrors] = useState({});

  // Auth form states
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    phone: '',
    birthday: '2004-05-29',
    password: '',
    confirmPassword: '',
  });
  const [resetForm, setResetForm] = useState({
    username: '',
    email: '',
    birthday: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Hub: Profile & Address state
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    phone: '',
    birthday: '',
    defaultAddress: {
      recipientName: '',
      phone: '',
      shippingAddress: '',
      city: '',
      barangay: '',
      postalCode: '',
      region: 'Metro Manila',
    },
  });
  const [profileSaving, setProfileSaving] = useState(false);

  // Hub: Password & Delete state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteWord, setDeleteWord] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Hub: Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Keep auth tab synced with URL param
  useEffect(() => {
    if (!authenticated) {
      if (modeParam === 'register') setAuthTab('register');
      else if (modeParam === 'forgot') setAuthTab('forgot');
      else setAuthTab('login');
    } else if (modeParam === 'profile' || modeParam === 'security' || modeParam === 'orders') {
      setHubTab(modeParam);
    }
  }, [modeParam, authenticated]);

  // Populate profile editor from authenticated user
  useEffect(() => {
    if (!user) return;
    setProfileForm({
      username: user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      birthday: user.birthday || '',
      defaultAddress: {
        recipientName: user.defaultAddress?.recipientName || '',
        phone: user.defaultAddress?.phone || user.phone || '',
        shippingAddress: user.defaultAddress?.shippingAddress || '',
        city: user.defaultAddress?.city || '',
        barangay: user.defaultAddress?.barangay || '',
        postalCode: user.defaultAddress?.postalCode || '',
        region: user.defaultAddress?.region || 'metro-manila',
      },
    });
  }, [user]);

  const loadOrders = useCallback(async () => {
    if (!authenticated) {
      setOrders([]);
      return;
    }
    setOrdersLoading(true);
    try {
      const list = await SquishiesAPI.fetchAccountOrders();
      setOrders(Array.isArray(list) ? list : []);
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function switchAuthTab(next) {
    setAuthTab(next);
    setFieldErrors({});
    setStatusBanner(null);
    setSearchParams(
      nextRedirect ? { mode: next, next: nextRedirect } : { mode: next },
      { replace: true }
    );
  }

  function applyApiFieldErrors(err, prefix = '', fieldOrder = [], fieldIdMap = {}) {
    const next = {};
    if (err?.fields) {
      if (Array.isArray(err.fields)) {
        for (const issue of err.fields) {
          if (issue?.field && !next[issue.field]) {
            next[issue.field] = issue.message;
          }
        }
      } else if (typeof err.fields === 'object') {
        for (const [field, message] of Object.entries(err.fields)) {
          if (field && typeof message === 'string') {
            const shortKey = field.includes('.') ? field.split('.').pop() : field;
            if (!next[shortKey]) {
              next[shortKey] = message;
            }
            if (!next[field]) {
              next[field] = message;
            }
          }
        }
      }
      setFieldErrors(next);
    }
    setStatusBanner({
      tone: 'error',
      text: err?.message || `${prefix}Please review the highlighted fields.`,
    });
    scrollToFirstInvalidField(next, fieldOrder, fieldIdMap, '.account-message--error');
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setStatusBanner(null);
    const loginOrder = ['identifier', 'password'];
    const loginIdMap = { identifier: 'login-identifier', password: 'login-password' };
    const errors = {};
    if (!loginForm.identifier.trim()) {
      errors.identifier = 'Enter your username or email address.';
    }
    if (!loginForm.password) {
      errors.password = 'Enter your password.';
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setStatusBanner({ tone: 'error', text: 'Enter your username/email and password.' });
      scrollToFirstInvalidField(errors, loginOrder, loginIdMap, '.account-message--error');
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const loggedUser = await login({
        identifier: loginForm.identifier.trim(),
        password: loginForm.password,
      });
      setLoginForm({ identifier: '', password: '' });
      if (nextRedirect && nextRedirect.startsWith('/')) {
        navigate(nextRedirect, { replace: true });
        return;
      }
      setSearchParams({ mode: 'account' }, { replace: true });
      setStatusBanner({
        tone: 'success',
        text: `Welcome back, @${loggedUser.username}! Your collector hub is synced.`,
      });
    } catch (err) {
      applyApiFieldErrors(err, '', loginOrder, loginIdMap);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    setStatusBanner(null);
    const regOrder = ['username', 'email', 'phone', 'birthday', 'password', 'confirmPassword'];
    const regIdMap = {
      username: 'reg-username',
      email: 'reg-email',
      phone: 'reg-phone',
      birthday: 'reg-birthday',
      password: 'reg-password',
      confirmPassword: 'reg-confirm',
    };
    const errors = validateRegisterFields(registerForm);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setStatusBanner({
        tone: 'error',
        text: Object.values(errors)[0],
      });
      scrollToFirstInvalidField(errors, regOrder, regIdMap, '.account-message--error');
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const created = await register({
        username: registerForm.username.trim(),
        email: registerForm.email.trim(),
        phone: registerForm.phone.trim(),
        birthday: registerForm.birthday,
        password: registerForm.password,
        confirmPassword: registerForm.confirmPassword,
      });
      setRegisterForm({
        username: '',
        email: '',
        phone: '',
        birthday: '2004-05-29',
        password: '',
        confirmPassword: '',
      });
      if (nextRedirect && nextRedirect.startsWith('/')) {
        navigate(nextRedirect, { replace: true });
        return;
      }
      setSearchParams({ mode: 'account' }, { replace: true });
      setStatusBanner({
        tone: 'success',
        text: `Account @${created.username} created and signed in!`,
      });
    } catch (err) {
      applyApiFieldErrors(err, '', regOrder, regIdMap);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetSubmit(event) {
    event.preventDefault();
    setStatusBanner(null);
    const resetOrder = ['username', 'email', 'birthday', 'newPassword', 'confirmPassword'];
    const resetIdMap = {
      username: 'reset-username',
      email: 'reset-email',
      birthday: 'reset-birthday',
      newPassword: 'reset-newpw',
      confirmPassword: 'reset-confirm',
    };
    const errors = validateResetPasswordFields(resetForm);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setStatusBanner({ tone: 'error', text: Object.values(errors)[0] });
      scrollToFirstInvalidField(errors, resetOrder, resetIdMap, '.account-message--error');
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await SquishiesAPI.resetPassword({
        username: resetForm.username.trim(),
        email: resetForm.email.trim(),
        birthday: resetForm.birthday,
        newPassword: resetForm.newPassword,
        confirmPassword: resetForm.confirmPassword,
      });
      const recoveredUsername = resetForm.username.trim();
      setResetForm({
        username: '',
        email: '',
        birthday: '',
        newPassword: '',
        confirmPassword: '',
      });
      setLoginForm({ identifier: recoveredUsername, password: '' });
      switchAuthTab('login');
      setStatusBanner({
        tone: 'success',
        text: `Password reset for @${recoveredUsername}. Sign in with your new password.`,
      });
    } catch (err) {
      applyApiFieldErrors(err, '', resetOrder, resetIdMap);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveProfile(event) {
    event.preventDefault();
    setStatusBanner(null);
    const profileOrder = [
      'username',
      'email',
      'phone',
      'birthday',
      'defaultAddress.recipientName',
      'defaultAddress.phone',
      'defaultAddress.shippingAddress',
      'defaultAddress.city',
      'defaultAddress.barangay',
      'defaultAddress.postalCode',
      'recipientName',
      'shippingAddress',
      'city',
      'barangay',
      'postalCode',
    ];
    const profileIdMap = {
      username: 'profile-username',
      email: 'profile-email',
      phone: 'profile-phone',
      birthday: 'profile-birthday',
      'defaultAddress.recipientName': 'addr-recipient',
      recipientName: 'addr-recipient',
      'defaultAddress.phone': 'addr-phone',
      'defaultAddress.shippingAddress': 'addr-street',
      shippingAddress: 'addr-street',
      'defaultAddress.city': 'addr-city',
      city: 'addr-city',
      'defaultAddress.barangay': 'addr-barangay',
      barangay: 'addr-barangay',
      'defaultAddress.postalCode': 'addr-postal',
      postalCode: 'addr-postal',
    };

    const addr = profileForm.defaultAddress;
    const hasAnyAddress = Boolean(
      addr.shippingAddress.trim() || addr.city.trim() || addr.barangay.trim() || addr.postalCode.trim()
    );
    const errors = validateProfileFields(profileForm, { withAddress: hasAnyAddress });
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setStatusBanner({ tone: 'error', text: Object.values(errors)[0] });
      scrollToFirstInvalidField(errors, profileOrder, profileIdMap, '.account-message--error');
      return;
    }

    setFieldErrors({});
    setProfileSaving(true);
    try {
      const payload = {
        username: profileForm.username.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim(),
        birthday: profileForm.birthday,
        defaultAddress: hasAnyAddress
          ? {
              recipientName: addr.recipientName.trim() || profileForm.username.trim(),
              phone: addr.phone.trim() || profileForm.phone.trim(),
              shippingAddress: addr.shippingAddress.trim(),
              city: addr.city.trim(),
              barangay: addr.barangay.trim(),
              postalCode: addr.postalCode.trim(),
              region: addr.region,
            }
          : null,
      };
      const res = await SquishiesAPI.updateAccountProfile(payload);
      setUser(res.user);
      setStatusBanner({
        tone: 'success',
        text: 'Profile & default delivery address saved to your collector account.',
      });
    } catch (err) {
      applyApiFieldErrors(err, '', profileOrder, profileIdMap);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    setStatusBanner(null);
    const pwOrder = ['currentPassword', 'newPassword', 'confirmPassword'];
    const pwIdMap = {
      currentPassword: 'sec-current',
      newPassword: 'sec-new',
      confirmPassword: 'sec-confirm',
    };
    const errors = {};
    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Enter your current password.';
    }
    const strength = getPasswordStrength(passwordForm.newPassword);
    if (!strength.checks.minLength || !strength.checks.hasUpper || !strength.checks.hasLower || !strength.checks.hasDigit) {
      errors.newPassword = 'Use 8+ chars with uppercase, lowercase, and at least 1 number.';
    }
    if (passwordForm.confirmPassword !== passwordForm.newPassword) {
      errors.confirmPassword = 'Your new passwords do not match.';
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setStatusBanner({ tone: 'error', text: Object.values(errors)[0] });
      scrollToFirstInvalidField(errors, pwOrder, pwIdMap, '.account-message--error');
      return;
    }

    setFieldErrors({});
    setPasswordSaving(true);
    try {
      await SquishiesAPI.changeAccountPassword(passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setStatusBanner({
        tone: 'success',
        text: 'Password updated securely. All active safety checks passed.',
      });
    } catch (err) {
      applyApiFieldErrors(err, '', pwOrder, pwIdMap);
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleLogout() {
    setStatusBanner(null);
    await logout();
    setOrders([]);
    setSearchParams({ mode: 'login' }, { replace: true });
    setStatusBanner({
      tone: 'success',
      text: 'Signed out cleanly. See you on your next squish drop!',
    });
  }

  async function handleDeleteAccount(event) {
    event.preventDefault();
    if (deleteWord !== 'DELETE' || !deletePassword) {
      setStatusBanner({
        tone: 'error',
        text: 'Enter your current password and type DELETE in all caps to confirm.',
      });
      return;
    }
    setDeleting(true);
    try {
      await SquishiesAPI.deleteAccount({
        password: deletePassword,
        confirmation: deleteWord,
      });
      await logout();
      setShowDeleteConfirm(false);
      setDeletePassword('');
      setDeleteWord('');
      setSearchParams({ mode: 'register' }, { replace: true });
      setStatusBanner({
        tone: 'success',
        text: 'Your collector account has been permanently removed.',
      });
    } catch (err) {
      applyApiFieldErrors(err);
    } finally {
      setDeleting(false);
    }
  }

  const orderCounts = useMemo(() => {
    const counts = { all: orders.length };
    for (const o of orders) {
      counts[o.status] = (counts[o.status] || 0) + 1;
    }
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'all') return orders;
    return orders.filter((o) => o.status === orderFilter);
  }, [orders, orderFilter]);

  if (loading) {
    return (
      <main className="account-jelly">
        <section className="account-card account-loading-card">
          <div className="account-loading-orb" aria-hidden="true" />
          <h1>Loading Collector Session...</h1>
          <p>Checking your encrypted Squishies session.</p>
        </section>
      </main>
    );
  }

  // ── AUTHENTICATED COLLECTOR HUB ──────────────────────────────────
  if (authenticated && user) {
    const activeOrdersCount =
      (orderCounts['To Pay'] || 0) +
      (orderCounts['To Ship'] || 0) +
      (orderCounts['Shipped'] || 0);
    const hasSavedAddress = Boolean(
      user.defaultAddress?.shippingAddress && user.defaultAddress?.city
    );
    const regionLabel =
      PH_REGIONS.find((r) => r.value === (user.defaultAddress?.region || 'metro-manila'))?.label ||
      user.defaultAddress?.region ||
      'Metro Manila';

    return (
      <main className="account-jelly">
        <section className="account-card account-card--wide account-hub-card">
          {/* UNIFIED COLLECTOR HERO BANNER */}
          <header className="account-hub-banner">
            <div className="account-hub-banner__identity">
              <div className="account-avatar" title={user.email}>
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="account-hub-banner__text">
                <div className="account-hub-banner__eyebrow-row">
                  <span className="account-eyebrow">SISO COLLECTOR HUB</span>
                  <span className="account-verified-badge">
                    {user.role === 'admin' ? 'Admin Account' : 'Verified Collector'}
                  </span>
                </div>
                <h1>Welcome, @{user.username}</h1>
                <div className="account-hub-meta-pills">
                  <span className="account-meta-pill">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    {user.email}
                  </span>
                  <span className="account-meta-pill">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    {user.phone || 'No mobile set'}
                  </span>
                </div>
              </div>
            </div>

            <div className="account-hub-banner__actions">
              {user.role === 'admin' && (
                <Link to="/admin" className="btn btn--outline btn--sm">
                  Admin Console
                </Link>
              )}
              <Link to="/shop.html" className="btn btn--outline btn--sm">
                Browse Shop
              </Link>
              <Link to="/checkout.html" className="btn btn--pink btn--sm">
                Checkout Bag
              </Link>
              <button
                type="button"
                className="btn btn--ghost btn--sm account-signout-top"
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
          </header>

          {/* AT-A-GLANCE COLLECTOR OVERVIEW STRIP */}
          <div className="account-hub-kpis" aria-label="Account summary">
            <button
              type="button"
              className={`account-kpi-card${hubTab === 'orders' && orderFilter === 'all' ? ' is-selected' : ''}`}
              onClick={() => {
                setHubTab('orders');
                setOrderFilter('all');
                setStatusBanner(null);
              }}
            >
              <span className="account-kpi-card__label">Total Purchases</span>
              <strong className="account-kpi-card__value">{orders.length}</strong>
              <span className="account-kpi-card__sub">
                {orders.length === 1 ? '1 recorded order' : `${orders.length} recorded orders`}
              </span>
            </button>

            <button
              type="button"
              className={`account-kpi-card${hubTab === 'orders' && orderFilter !== 'all' ? ' is-selected' : ''}`}
              onClick={() => {
                setHubTab('orders');
                setOrderFilter(orderCounts['To Pay'] ? 'To Pay' : orderCounts['To Ship'] ? 'To Ship' : 'all');
                setStatusBanner(null);
              }}
            >
              <span className="account-kpi-card__label">Active / In Transit</span>
              <strong className="account-kpi-card__value">{activeOrdersCount}</strong>
              <span className="account-kpi-card__sub">
                {activeOrdersCount > 0 ? 'Track live delivery status' : 'No pending shipments'}
              </span>
            </button>

            <button
              type="button"
              className={`account-kpi-card${hubTab === 'profile' ? ' is-selected' : ''}`}
              onClick={() => {
                setHubTab('profile');
                setFieldErrors({});
                setStatusBanner(null);
              }}
            >
              <span className="account-kpi-card__label">Default Delivery Address</span>
              <strong className="account-kpi-card__value account-kpi-card__value--text">
                {hasSavedAddress ? `${user.defaultAddress.city}, ${regionLabel}` : 'Not Set Yet'}
              </strong>
              <span className="account-kpi-card__sub">
                {hasSavedAddress
                  ? `${user.defaultAddress.shippingAddress}`
                  : 'Add address for instant checkout →'}
              </span>
            </button>
          </div>

          {/* PRIMARY NAVIGATION TABS */}
          <div className="account-hub-tabs" role="tablist" aria-label="Account sections">
            <button
              type="button"
              role="tab"
              aria-selected={hubTab === 'orders'}
              className={hubTab === 'orders' ? 'is-active' : ''}
              onClick={() => {
                setHubTab('orders');
                setStatusBanner(null);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span>My Purchases</span>
              <small className="account-tab-badge">{orders.length}</small>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={hubTab === 'profile'}
              className={hubTab === 'profile' ? 'is-active' : ''}
              onClick={() => {
                setHubTab('profile');
                setFieldErrors({});
                setStatusBanner(null);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Profile &amp; Saved Address</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={hubTab === 'security'}
              className={hubTab === 'security' ? 'is-active' : ''}
              onClick={() => {
                setHubTab('security');
                setFieldErrors({});
                setStatusBanner(null);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              </svg>
              <span>Security &amp; Session</span>
            </button>
          </div>

          {statusBanner && (
            <p
              className={`account-message account-message--${statusBanner.tone}`}
              role={statusBanner.tone === 'error' ? 'alert' : 'status'}
            >
              {statusBanner.text}
            </p>
          )}

          {hubTab === 'orders' && (
            <div className="account-orders-panel account-setting-section">
              <div className="account-orders-header">
                <div>
                  <h2>Order History &amp; Live Tracking</h2>
                  <p>Filter by fulfillment stage to pay, track shipments, or download official receipts.</p>
                </div>
                <button
                  type="button"
                  className="btn btn--outline btn--xs"
                  onClick={loadOrders}
                  disabled={ordersLoading}
                >
                  {ordersLoading ? 'Syncing...' : 'Refresh Orders'}
                </button>
              </div>

              <div className="account-order-filters" role="tablist" aria-label="Filter purchases">
                {ORDER_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={orderFilter === tab.id}
                    className={orderFilter === tab.id ? 'is-active' : ''}
                    onClick={() => setOrderFilter(tab.id)}
                  >
                    <span>{tab.label}</span>
                    <small>{orderCounts[tab.id] || 0}</small>
                  </button>
                ))}
              </div>

              {ordersLoading ? (
                <div className="account-orders-empty">
                  <p>Loading your orders...</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="account-orders-empty">
                  <div className="account-orders-empty__icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                      <path d="m3.3 7 8.7 5 8.7-5" />
                      <path d="M12 22V12" />
                    </svg>
                  </div>
                  <h3>No orders in {orderFilter === 'all' ? 'your account yet' : `"${orderFilter}"`}</h3>
                  <p>
                    Orders placed while signed in—or with your matching account email—appear here automatically with live tracking and receipts.
                  </p>
                  <div className="account-orders-empty__actions">
                    {orderFilter !== 'all' && (
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => setOrderFilter('all')}
                      >
                        Show All Orders
                      </button>
                    )}
                    <Link to="/shop.html" className="btn btn--primary">
                      Explore Catalog
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="account-orders-list">
                  {filteredOrders.map((order) => (
                    <article key={order.orderNumber} className="account-order-card">
                      <div className="account-order-card__top">
                        <div>
                          <span className="account-order-card__num">{order.orderNumber}</span>
                          <span className="account-order-card__date">
                            Placed {new Date(order.createdAt).toLocaleString()} • {order.paymentMethod.toUpperCase()}
                          </span>
                        </div>
                        <span className={`account-order-pill ${statusPillTone(order.status)}`}>
                          {order.deliveryStage === 'out_for_delivery' ? 'Out for Delivery' : order.status}
                        </span>
                      </div>

                      <div className="account-order-card__items">
                        {order.items.slice(0, 3).map((item) => (
                          <div key={`${order.orderNumber}-${item.slug}`} className="account-order-chip">
                            <span className="account-order-chip__badge">SQ</span>
                            <span>
                              {item.name} <strong>×{item.quantity}</strong>
                            </span>
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <span className="account-order-more">+{order.items.length - 3} more</span>
                        )}
                      </div>

                      <div className="account-order-card__bottom">
                        <div className="account-order-card__meta">
                          <span>Payment: <strong>{order.paymentStatus}</strong></span>
                          <span className="account-order-card__total">Total: {formatPhp(order.total)}</span>
                        </div>
                        <div className="account-order-card__actions">
                          <Link
                            to={`/checkout.html?order=${encodeURIComponent(order.orderNumber)}`}
                            className={`btn btn--sm ${order.status === 'To Pay' ? 'btn--pink' : 'btn--outline'}`}
                          >
                            {order.status === 'To Pay'
                              ? 'Pay Now →'
                              : order.status === 'Completed'
                                ? 'Official Receipt & Review →'
                                : 'Track Delivery →'}
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {hubTab === 'profile' && (
            <form className="account-profile-form" onSubmit={handleSaveProfile} noValidate>
              <div className="account-settings-grid">
                <section className="account-setting-section">
                  <div className="account-section-heading">
                    <span className="account-section-icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <div>
                      <h2>Collector Identity</h2>
                      <p>Keep your username, contact email, mobile number, and birthday up to date.</p>
                    </div>
                  </div>
                  <div className="account-form">
                    <div className="account-field">
                      <label htmlFor="profile-username">Username</label>
                      <input
                        id="profile-username"
                        type="text"
                        value={profileForm.username}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            username: sanitizeUsername(e.target.value),
                          }))
                        }
                        maxLength={28}
                        className={fieldErrors.username ? 'is-invalid' : ''}
                      />
                      {fieldErrors.username && <small className="account-field-error">{fieldErrors.username}</small>}
                    </div>

                    <div className="account-field">
                      <label htmlFor="profile-email">Email Address</label>
                      <input
                        id="profile-email"
                        type="email"
                        maxLength={FIELD_LIMITS.email}
                        value={profileForm.email}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            email: sanitizeEmail(e.target.value),
                          }))
                        }
                        className={fieldErrors.email ? 'is-invalid' : ''}
                      />
                      {fieldErrors.email && <small className="account-field-error">{fieldErrors.email}</small>}
                    </div>

                    <div className="account-field-row">
                      <div className="account-field">
                        <label htmlFor="profile-phone">Mobile Number (11 Digits)</label>
                        <input
                          id="profile-phone"
                          type="tel"
                          inputMode="numeric"
                          maxLength={FIELD_LIMITS.phone}
                          placeholder="09171234567"
                          value={profileForm.phone}
                          onChange={(e) =>
                            setProfileForm((prev) => ({
                              ...prev,
                              phone: sanitizePhPhone(e.target.value),
                            }))
                          }
                          className={fieldErrors.phone ? 'is-invalid' : ''}
                        />
                        {fieldErrors.phone && <small className="account-field-error">{fieldErrors.phone}</small>}
                      </div>

                      <div className="account-field">
                        <label htmlFor="profile-birthday">Birthday</label>
                        <input
                          id="profile-birthday"
                          type="date"
                          value={profileForm.birthday}
                          onChange={(e) =>
                            setProfileForm((prev) => ({ ...prev, birthday: e.target.value }))
                          }
                          className={fieldErrors.birthday ? 'is-invalid' : ''}
                        />
                        {fieldErrors.birthday && <small className="account-field-error">{fieldErrors.birthday}</small>}
                      </div>
                    </div>

                    <div className="account-identity-note">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                      <span>
                        Your username, email, and birthday are also used to verify identity during password recovery.
                      </span>
                    </div>
                  </div>
                </section>

                <section className="account-setting-section">
                  <div className="account-section-heading">
                    <span className="account-section-icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </span>
                    <div>
                      <h2>Default Delivery Address</h2>
                      <p>Auto-fills your recipient and shipping details when you open Checkout.</p>
                    </div>
                  </div>
                  <div className="account-form">
                    <div className="account-field-row">
                      <div className="account-field">
                        <label htmlFor="addr-recipient">Recipient Full Name</label>
                        <input
                          id="addr-recipient"
                          type="text"
                          maxLength={FIELD_LIMITS.name}
                          placeholder="Juana Dela Cruz"
                          value={profileForm.defaultAddress.recipientName}
                          onChange={(e) =>
                            setProfileForm((prev) => ({
                              ...prev,
                              defaultAddress: {
                                ...prev.defaultAddress,
                                recipientName: sanitizePersonName(e.target.value),
                              },
                            }))
                          }
                          className={fieldErrors['defaultAddress.recipientName'] ? 'is-invalid' : ''}
                        />
                        {fieldErrors['defaultAddress.recipientName'] && (
                          <small className="account-field-error">{fieldErrors['defaultAddress.recipientName']}</small>
                        )}
                      </div>

                      <div className="account-field">
                        <label htmlFor="addr-phone">Delivery Contact (11 Digits)</label>
                        <input
                          id="addr-phone"
                          type="tel"
                          inputMode="numeric"
                          maxLength={FIELD_LIMITS.phone}
                          placeholder="09171234567"
                          value={profileForm.defaultAddress.phone}
                          onChange={(e) =>
                            setProfileForm((prev) => ({
                              ...prev,
                              defaultAddress: {
                                ...prev.defaultAddress,
                                phone: sanitizePhPhone(e.target.value),
                              },
                            }))
                          }
                          className={fieldErrors['defaultAddress.phone'] ? 'is-invalid' : ''}
                        />
                        {fieldErrors['defaultAddress.phone'] && (
                          <small className="account-field-error">{fieldErrors['defaultAddress.phone']}</small>
                        )}
                      </div>
                    </div>

                    <div className="account-field">
                      <label htmlFor="addr-street">Street Address / House / Unit No.</label>
                      <input
                        id="addr-street"
                        type="text"
                        maxLength={FIELD_LIMITS.address}
                        placeholder="Unit 14B, Katipunan Ave"
                        value={profileForm.defaultAddress.shippingAddress}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            defaultAddress: {
                              ...prev.defaultAddress,
                              shippingAddress: sanitizeStreetAddress(e.target.value),
                            },
                          }))
                        }
                        className={fieldErrors['defaultAddress.shippingAddress'] ? 'is-invalid' : ''}
                      />
                      {fieldErrors['defaultAddress.shippingAddress'] && (
                        <small className="account-field-error">{fieldErrors['defaultAddress.shippingAddress']}</small>
                      )}
                    </div>

                    <div className="account-field-row">
                      <div className="account-field">
                        <label htmlFor="addr-city">City / Municipality</label>
                        <input
                          id="addr-city"
                          type="text"
                          maxLength={FIELD_LIMITS.city}
                          placeholder="Quezon City"
                          value={profileForm.defaultAddress.city}
                          onChange={(e) =>
                            setProfileForm((prev) => ({
                              ...prev,
                              defaultAddress: {
                                ...prev.defaultAddress,
                                city: sanitizeCityName(e.target.value),
                              },
                            }))
                          }
                          className={fieldErrors['defaultAddress.city'] ? 'is-invalid' : ''}
                        />
                        {fieldErrors['defaultAddress.city'] && (
                          <small className="account-field-error">{fieldErrors['defaultAddress.city']}</small>
                        )}
                      </div>

                      <div className="account-field">
                        <label htmlFor="addr-barangay">Barangay</label>
                        <input
                          id="addr-barangay"
                          type="text"
                          maxLength={FIELD_LIMITS.barangay}
                          placeholder="Loyola Heights"
                          value={profileForm.defaultAddress.barangay}
                          onChange={(e) =>
                            setProfileForm((prev) => ({
                              ...prev,
                              defaultAddress: {
                                ...prev.defaultAddress,
                                barangay: sanitizeBarangayName(e.target.value),
                              },
                            }))
                          }
                          className={fieldErrors['defaultAddress.barangay'] ? 'is-invalid' : ''}
                        />
                        {fieldErrors['defaultAddress.barangay'] && (
                          <small className="account-field-error">{fieldErrors['defaultAddress.barangay']}</small>
                        )}
                      </div>
                    </div>

                    <div className="account-field-row">
                      <div className="account-field">
                        <label htmlFor="addr-postal">ZIP / Postal Code</label>
                        <input
                          id="addr-postal"
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="1108"
                          value={profileForm.defaultAddress.postalCode}
                          onChange={(e) =>
                            setProfileForm((prev) => ({
                              ...prev,
                              defaultAddress: {
                                ...prev.defaultAddress,
                                postalCode: sanitizeDigits(e.target.value, 4),
                              },
                            }))
                          }
                          className={fieldErrors['defaultAddress.postalCode'] ? 'is-invalid' : ''}
                        />
                        {fieldErrors['defaultAddress.postalCode'] && (
                          <small className="account-field-error">{fieldErrors['defaultAddress.postalCode']}</small>
                        )}
                      </div>

                      <div className="account-field">
                        <label htmlFor="addr-region">Region</label>
                        <select
                          id="addr-region"
                          value={profileForm.defaultAddress.region}
                          onChange={(e) =>
                            setProfileForm((prev) => ({
                              ...prev,
                              defaultAddress: {
                                ...prev.defaultAddress,
                                region: e.target.value,
                              },
                            }))
                          }
                        >
                          {PH_REGIONS.map((reg) => (
                            <option key={reg.value} value={reg.value}>{reg.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="account-save-bar">
                <span className="account-save-bar__hint">
                  Changes apply immediately to your profile and auto-fill on your next Checkout.
                </span>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={profileSaving}
                >
                  {profileSaving ? 'Saving Changes...' : 'Save Profile & Address'}
                </button>
              </div>
            </form>
          )}

          {hubTab === 'security' && (
            <div className="account-settings-grid account-security-grid">
              <section className="account-setting-section">
                <div className="account-section-heading">
                  <span className="account-section-icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <div>
                    <h2>Change Password</h2>
                    <p>Verified against your current password before hashing and saving.</p>
                  </div>
                </div>
                <form className="account-form" onSubmit={handleChangePassword} noValidate>
                  <div className="account-field">
                    <label htmlFor="sec-current">Current Password</label>
                    <PasswordInput
                      id="sec-current"
                      name="currentPassword"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                      }
                      placeholder="Current password"
                      autoComplete="current-password"
                      hasError={Boolean(fieldErrors.currentPassword)}
                    />
                    {fieldErrors.currentPassword && (
                      <small className="account-field-error">{fieldErrors.currentPassword}</small>
                    )}
                  </div>
                  <div className="account-field">
                    <label htmlFor="sec-new">New Password</label>
                    <PasswordInput
                      id="sec-new"
                      name="newPassword"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                      }
                      placeholder="8+ chars, upper + lower + number"
                      autoComplete="new-password"
                      hasError={Boolean(fieldErrors.newPassword)}
                    />
                    <PasswordStrengthMeter password={passwordForm.newPassword} />
                    {fieldErrors.newPassword && (
                      <small className="account-field-error">{fieldErrors.newPassword}</small>
                    )}
                  </div>
                  <div className="account-field">
                    <label htmlFor="sec-confirm">Confirm New Password</label>
                    <PasswordInput
                      id="sec-confirm"
                      name="confirmPassword"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                      }
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                      hasError={Boolean(fieldErrors.confirmPassword)}
                    />
                    {fieldErrors.confirmPassword && (
                      <small className="account-field-error">{fieldErrors.confirmPassword}</small>
                    )}
                  </div>
                  <div className="account-form-footer">
                    <button type="submit" className="btn btn--primary" disabled={passwordSaving}>
                      {passwordSaving ? 'Updating Password...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </section>

              <div className="account-security-side">
                <section className="account-setting-section account-logout-card">
                  <div className="account-section-heading">
                    <span className="account-section-icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" x2="9" y1="12" y2="12" />
                      </svg>
                    </span>
                    <div>
                      <h2>Active Browser Session</h2>
                      <p>
                        Signed in as <strong>@{user.username}</strong>. Ending your session clears your active browser token cleanly.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="btn btn--secondary" onClick={handleLogout}>
                    Log Out of Session
                  </button>
                </section>

                <section className="account-danger-section">
                  <div className="account-section-heading">
                    <span className="account-section-icon account-section-icon--danger" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </span>
                    <div>
                      <h2>Delete Collector Account</h2>
                      <p>
                        Permanently removes your collector profile while preserving anonymized historical order records.
                      </p>
                    </div>
                  </div>
                  {!showDeleteConfirm ? (
                    <button
                      type="button"
                      className="btn btn--danger-outline"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      Delete Account
                    </button>
                  ) : (
                    <form className="account-delete-confirm" onSubmit={handleDeleteAccount}>
                      <p>
                        Enter your current password and type <strong>DELETE</strong> to permanently remove @{user.username}:
                      </p>
                      <PasswordInput
                        id="delete-password"
                        name="deletePassword"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Current password"
                        autoComplete="current-password"
                      />
                      <input
                        type="text"
                        value={deleteWord}
                        onChange={(e) => setDeleteWord(e.target.value)}
                        placeholder="Type DELETE"
                        aria-label="Type DELETE to confirm"
                      />
                      <div className="account-delete-actions">
                        <button
                          type="submit"
                          className="btn btn--danger"
                          disabled={deleting || deleteWord !== 'DELETE' || !deletePassword}
                        >
                          {deleting ? 'Deleting...' : 'Confirm Permanent Deletion'}
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteWord('');
                            setDeletePassword('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </section>
              </div>
            </div>
          )}
        </section>
      </main>
    );
  }

  // ── UNAUTHENTICATED LOGIN / CREATE ACCOUNT / FORGOT PASSWORD ─────
  return (
    <main className="account-jelly account-jelly--split">
      <div className="account-auth-split account-auth-card">
        {/* LEFT COLUMN: AUTHENTICATION FORM */}
        <section className="account-auth-pane" aria-labelledby="authHeading">
          <div className="account-auth-header">
            <h1 id="authHeading" className="account-split-title">
              {authTab === 'login'
                ? 'Hello Again!'
                : authTab === 'register'
                  ? 'Join the Collective!'
                  : 'Reset Password'}
            </h1>
            <p className="account-split-subtitle">
              {authTab === 'login'
                ? "Let's get started with your squishy collection."
                : authTab === 'register'
                  ? 'Unlock saved delivery addresses, instant checkout, and order receipts.'
                  : 'Verify your username, email, and birthday to set a new password.'}
            </p>
          </div>

          <div className="account-switch account-switch--pill" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={authTab === 'login'}
              className={authTab === 'login' ? 'is-active' : ''}
              onClick={() => switchAuthTab('login')}
            >
              Log In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authTab === 'register'}
              className={authTab === 'register' ? 'is-active' : ''}
              onClick={() => switchAuthTab('register')}
            >
              Create Account
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authTab === 'forgot'}
              className={authTab === 'forgot' ? 'is-active' : ''}
              onClick={() => switchAuthTab('forgot')}
            >
              Reset
            </button>
          </div>

          {statusBanner && (
            <p
              className={`account-message account-message--${statusBanner.tone}`}
              role={statusBanner.tone === 'error' ? 'alert' : 'status'}
            >
              {statusBanner.text}
            </p>
          )}

          {authTab === 'login' && (
            <form className="account-form" onSubmit={handleLoginSubmit} noValidate>
              <div className="account-field">
                <label htmlFor="login-identifier">Email Address or Username</label>
                <input
                  id="login-identifier"
                  name="identifier"
                  type="text"
                  maxLength={FIELD_LIMITS.email}
                  placeholder="name@email.com or username"
                  autoComplete="username"
                  value={loginForm.identifier}
                  onChange={(e) =>
                    setLoginForm((prev) => ({
                      ...prev,
                      identifier: sanitizeEmail(e.target.value),
                    }))
                  }
                  className={fieldErrors.identifier ? 'is-invalid' : ''}
                  required
                />
                {fieldErrors.identifier && (
                  <small className="account-field-error">{fieldErrors.identifier}</small>
                )}
              </div>

              <div className="account-field">
                <div className="account-field-header">
                  <label htmlFor="login-password">Password</label>
                  <button
                    type="button"
                    className="account-link-recovery"
                    onClick={() => switchAuthTab('forgot')}
                  >
                    Recovery Password
                  </button>
                </div>
                <PasswordInput
                  id="login-password"
                  name="password"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder="Password"
                  autoComplete="current-password"
                  hasError={Boolean(fieldErrors.password)}
                />
                {fieldErrors.password && (
                  <small className="account-field-error">{fieldErrors.password}</small>
                )}
              </div>

              <button
                type="submit"
                className={`account-submit account-submit--mauve${submitting ? ' is-loading' : ''}`}
                disabled={submitting}
              >
                {submitting ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          )}

          {authTab === 'register' && (
            <form className="account-form" onSubmit={handleRegisterSubmit} noValidate>
              <div className="account-field">
                <label htmlFor="reg-username">Username (Letters, Numbers &amp; _)</label>
                <input
                  id="reg-username"
                  name="username"
                  type="text"
                  maxLength={28}
                  placeholder="squishy_collector"
                  autoComplete="username"
                  value={registerForm.username}
                  onChange={(e) =>
                    setRegisterForm((prev) => ({
                      ...prev,
                      username: sanitizeUsername(e.target.value),
                    }))
                  }
                  className={fieldErrors.username ? 'is-invalid' : ''}
                  required
                />
                {fieldErrors.username && (
                  <small className="account-field-error">{fieldErrors.username}</small>
                )}
              </div>

              <div className="account-field">
                <label htmlFor="reg-email">Email Address</label>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  maxLength={FIELD_LIMITS.email}
                  placeholder="you@domain.com"
                  autoComplete="email"
                  value={registerForm.email}
                  onChange={(e) =>
                    setRegisterForm((prev) => ({
                      ...prev,
                      email: sanitizeEmail(e.target.value),
                    }))
                  }
                  className={fieldErrors.email ? 'is-invalid' : ''}
                  required
                />
                {fieldErrors.email && (
                  <small className="account-field-error">{fieldErrors.email}</small>
                )}
              </div>

              <div className="account-field-row">
                <div className="account-field">
                  <label htmlFor="reg-phone">Contact Number (11 Digits)</label>
                  <input
                    id="reg-phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="09171234567"
                    autoComplete="tel-national"
                    value={registerForm.phone}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({
                        ...prev,
                        phone: sanitizePhPhone(e.target.value),
                      }))
                    }
                    className={fieldErrors.phone ? 'is-invalid' : ''}
                    required
                  />
                  {fieldErrors.phone && (
                    <small className="account-field-error">{fieldErrors.phone}</small>
                  )}
                </div>

                <div className="account-field">
                  <label htmlFor="reg-birthday">Birthday</label>
                  <input
                    id="reg-birthday"
                    name="birthday"
                    type="date"
                    value={registerForm.birthday}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({ ...prev, birthday: e.target.value }))
                    }
                    className={fieldErrors.birthday ? 'is-invalid' : ''}
                    required
                  />
                  {fieldErrors.birthday && (
                    <small className="account-field-error">{fieldErrors.birthday}</small>
                  )}
                </div>
              </div>

              <div className="account-field">
                <label htmlFor="reg-password">Password</label>
                <PasswordInput
                  id="reg-password"
                  name="password"
                  value={registerForm.password}
                  onChange={(e) =>
                    setRegisterForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder="8+ chars, upper + lower + number"
                  autoComplete="new-password"
                  hasError={Boolean(fieldErrors.password)}
                />
                <PasswordStrengthMeter password={registerForm.password} />
                {fieldErrors.password && (
                  <small className="account-field-error">{fieldErrors.password}</small>
                )}
              </div>

              <div className="account-field">
                <label htmlFor="reg-confirm">Confirm Password</label>
                <PasswordInput
                  id="reg-confirm"
                  name="confirmPassword"
                  value={registerForm.confirmPassword}
                  onChange={(e) =>
                    setRegisterForm((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  hasError={Boolean(fieldErrors.confirmPassword)}
                />
                {fieldErrors.confirmPassword && (
                  <small className="account-field-error">{fieldErrors.confirmPassword}</small>
                )}
              </div>

              <button
                type="submit"
                className={`account-submit account-submit--mauve${submitting ? ' is-loading' : ''}`}
                disabled={submitting}
              >
                {submitting ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          {authTab === 'forgot' && (
            <form className="account-form" onSubmit={handleResetSubmit} noValidate>
              <div className="account-field">
                <label htmlFor="reset-username">Account Username</label>
                <input
                  id="reset-username"
                  name="username"
                  type="text"
                  maxLength={28}
                  placeholder="Your username"
                  value={resetForm.username}
                  onChange={(e) =>
                    setResetForm((prev) => ({
                      ...prev,
                      username: sanitizeUsername(e.target.value),
                    }))
                  }
                  className={fieldErrors.username ? 'is-invalid' : ''}
                  required
                />
                {fieldErrors.username && (
                  <small className="account-field-error">{fieldErrors.username}</small>
                )}
              </div>

              <div className="account-field-row">
                <div className="account-field">
                  <label htmlFor="reset-email">Registered Email</label>
                  <input
                    id="reset-email"
                    name="email"
                    type="email"
                    maxLength={FIELD_LIMITS.email}
                    placeholder="you@domain.com"
                    value={resetForm.email}
                    onChange={(e) =>
                      setResetForm((prev) => ({
                        ...prev,
                        email: sanitizeEmail(e.target.value),
                      }))
                    }
                    className={fieldErrors.email ? 'is-invalid' : ''}
                    required
                  />
                  {fieldErrors.email && (
                    <small className="account-field-error">{fieldErrors.email}</small>
                  )}
                </div>

                <div className="account-field">
                  <label htmlFor="reset-birthday">Registered Birthday</label>
                  <input
                    id="reset-birthday"
                    name="birthday"
                    type="date"
                    value={resetForm.birthday}
                    onChange={(e) =>
                      setResetForm((prev) => ({ ...prev, birthday: e.target.value }))
                    }
                    className={fieldErrors.birthday ? 'is-invalid' : ''}
                    required
                  />
                  {fieldErrors.birthday && (
                    <small className="account-field-error">{fieldErrors.birthday}</small>
                  )}
                </div>
              </div>

              <div className="account-field">
                <label htmlFor="reset-newpw">New Password</label>
                <PasswordInput
                  id="reset-newpw"
                  name="newPassword"
                  value={resetForm.newPassword}
                  onChange={(e) =>
                    setResetForm((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                  placeholder="8+ chars, upper + lower + number"
                  autoComplete="new-password"
                  hasError={Boolean(fieldErrors.newPassword)}
                />
                <PasswordStrengthMeter password={resetForm.newPassword} />
                {fieldErrors.newPassword && (
                  <small className="account-field-error">{fieldErrors.newPassword}</small>
                )}
              </div>

              <div className="account-field">
                <label htmlFor="reset-confirm">Confirm New Password</label>
                <PasswordInput
                  id="reset-confirm"
                  name="confirmPassword"
                  value={resetForm.confirmPassword}
                  onChange={(e) =>
                    setResetForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                  hasError={Boolean(fieldErrors.confirmPassword)}
                />
                {fieldErrors.confirmPassword && (
                  <small className="account-field-error">{fieldErrors.confirmPassword}</small>
                )}
              </div>

              <button
                type="submit"
                className={`account-submit account-submit--mauve${submitting ? ' is-loading' : ''}`}
                disabled={submitting}
              >
                {submitting ? 'Verifying & Updating...' : 'Reset Password'}
              </button>
            </form>
          )}

          <div className="account-bottom">
            {authTab === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button type="button" onClick={() => switchAuthTab('register')}>
                  Create an account
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button type="button" onClick={() => switchAuthTab('login')}>
                  Back to Sign In
                </button>
              </p>
            )}
            <Link to="/shop.html" className="account-back">
              ← Back to Squishies Shop
            </Link>
          </div>
        </section>

        {/* RIGHT COLUMN: SISO LOGO ONLY (INTERACTIVE SQUISHABLE) */}
        <aside className="account-auth-showcase" aria-label="SISO brand showcase">
          <SquishableSisoLogo />
        </aside>
      </div>
    </main>
  );
}

let sharedSqueakCtx = null;
function playLogoPlushSqueak(isRelease = false) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedSqueakCtx) sharedSqueakCtx = new AudioCtx();
    if (sharedSqueakCtx.state === 'suspended') sharedSqueakCtx.resume();
    const now = sharedSqueakCtx.currentTime;
    const osc = sharedSqueakCtx.createOscillator();
    const gain = sharedSqueakCtx.createGain();
    osc.type = 'sine';
    if (!isRelease) {
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.09);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(sharedSqueakCtx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    } else {
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.12);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.045, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(gain);
      gain.connect(sharedSqueakCtx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    }
  } catch {
    // Ignore audio errors on restricted autoplay contexts
  }
}

function SquishableSisoLogo() {
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const stateRef = useRef({
    pressed: false,
    sq: 0,
    sqv: 0,
    nx: 0,
    ny: 0,
    tx: 0,
    ty: 0,
    rafId: 0,
    lastTime: 0,
  });

  const startLoop = useCallback(() => {
    const st = stateRef.current;
    if (st.rafId) return;
    st.lastTime = performance.now();

    const tick = (now) => {
      const dt = Math.min(0.032, (now - st.lastTime) / 1000 || 0.016);
      st.lastTime = now;

      const target = st.pressed ? 1 : 0;
      const k = st.pressed ? 165 : 46;
      const d = st.pressed ? 14 : 3.8;
      st.sqv += (k * (target - st.sq) - d * st.sqv) * dt;
      st.sq += st.sqv * dt;

      const lerp = Math.min(1, dt * 12);
      st.tx += (st.nx - st.tx) * lerp;
      st.ty += (st.ny - st.ty) * lerp;

      const img = imgRef.current;
      if (img) {
        const sx = 1 + st.sq * 0.28;
        const sy = Math.max(0.56, 1 - st.sq * 0.33);
        const shiftY = st.sq * 18;
        const rotX = -st.ty * (10 + st.sq * 8);
        const rotY = st.tx * (12 + st.sq * 8);
        const skewX = st.tx * st.sq * -6;
        img.style.transform = `perspective(620px) translate3d(${(st.tx * 6).toFixed(2)}px, ${shiftY.toFixed(2)}px, 0) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) skewX(${skewX.toFixed(2)}deg) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
      }

      const stillMoving =
        st.pressed ||
        Math.abs(st.sq) > 0.002 ||
        Math.abs(st.sqv) > 0.008 ||
        Math.abs(st.tx - st.nx) > 0.003 ||
        Math.abs(st.ty - st.ny) > 0.003;

      if (stillMoving) {
        st.rafId = requestAnimationFrame(tick);
      } else {
        st.sq = 0;
        st.sqv = 0;
        st.rafId = 0;
        if (img && !st.nx && !st.ny) {
          img.style.transform = '';
        }
      }
    };

    st.rafId = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const st = stateRef.current;
    return () => {
      if (st.rafId) cancelAnimationFrame(st.rafId);
    };
  }, []);

  const updatePointerNormal = (e) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / (r.width * 0.45 || 1)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / (r.height * 0.45 || 1)));
    stateRef.current.nx = nx;
    stateRef.current.ny = ny;
  };

  const handlePointerDown = (e) => {
    const st = stateRef.current;
    st.pressed = true;
    st.sqv = Math.max(st.sqv, 3.8);
    updatePointerNormal(e);
    if (wrapRef.current?.setPointerCapture && e.pointerId != null) {
      try {
        wrapRef.current.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic pointer capture errors
      }
    }
    if (navigator.vibrate) navigator.vibrate(8);
    playLogoPlushSqueak(false);
    startLoop();
  };

  const handlePointerMove = (e) => {
    updatePointerNormal(e);
    startLoop();
  };

  const handlePointerUp = () => {
    const st = stateRef.current;
    if (!st.pressed) return;
    st.pressed = false;
    playLogoPlushSqueak(true);
    startLoop();
  };

  const handlePointerLeave = () => {
    const st = stateRef.current;
    st.nx = 0;
    st.ny = 0;
    if (st.pressed) {
      st.pressed = false;
      playLogoPlushSqueak(true);
    }
    startLoop();
  };

  const handleKeyDown = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const st = stateRef.current;
      if (!st.pressed) {
        st.pressed = true;
        st.sqv = 4.2;
        playLogoPlushSqueak(false);
        startLoop();
      }
    }
  };

  const handleKeyUp = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const st = stateRef.current;
      st.pressed = false;
      playLogoPlushSqueak(true);
      startLoop();
    }
  };

  return (
    <div
      ref={wrapRef}
      className="account-showcase-logo-wrapper is-squishable"
      role="button"
      tabIndex={0}
      aria-label="Squish the SISO logo"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <img
        ref={imgRef}
        src="/assets/images/logo-mark.svg"
        alt="SISO Logo"
        className="account-showcase-logo-large"
        draggable={false}
      />
    </div>
  );
}
