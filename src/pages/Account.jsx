import { useCallback, useEffect, useMemo, useState } from 'react';
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
    return (
      <main className="account-jelly">
        <section className="account-card account-card--wide account-hub-card">
          <div className="account-dashboard-heading">
            <div>
              <span className="account-eyebrow">SISO COLLECTOR HUB</span>
              <h1>Welcome, @{user.username}</h1>
              <p>
                Track live orders, pay via GCash simulation, manage saved Shopee-style addresses, and secure your profile.
              </p>
            </div>
            <div className="account-hub-right">
              <div className="account-avatar" title={user.email}>
                {user.username.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

          <div className="account-profile-summary">
            <div>
              <span className="account-summary-label">SIGNED IN COLLECTOR</span>
              <strong>@{user.username}</strong>
              <span className="account-summary-meta">{user.email} • {user.phone || 'No mobile set'}</span>
            </div>
            <div className="account-summary-badges">
              <span className="account-verified-badge">
                {user.role === 'admin' ? 'Admin Account' : 'Verified Session'}
              </span>
              {user.role === 'admin' && (
                <Link to="/admin" className="btn btn--outline btn--sm">
                  Admin Console
                </Link>
              )}
              <Link to="/shop.html" className="btn btn--outline btn--sm">
                Browse Squishies
              </Link>
              <Link to="/checkout.html" className="btn btn--pink btn--sm">
                Checkout Bag
              </Link>
            </div>
          </div>

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
              My Purchases ({orders.length})
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
              Profile &amp; Saved Address
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
              Security &amp; Session
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
            <div className="account-orders-panel">
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
                  <h3>No orders in {orderFilter === 'all' ? 'your account yet' : `"${orderFilter}"`}</h3>
                  <p>
                    Orders placed while signed in—or with your matching account email—appear here automatically with live tracking and receipts.
                  </p>
                  <Link to="/shop.html" className="btn btn--primary">
                    Explore Catalog
                  </Link>
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
                    <span className="account-section-icon" aria-hidden="true">ID</span>
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

                    <div className="account-field">
                      <label htmlFor="profile-phone">Mobile Number (PH Digits Only)</label>
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
                </section>

                <section className="account-setting-section">
                  <div className="account-section-heading">
                    <span className="account-section-icon" aria-hidden="true">PH</span>
                    <div>
                      <h2>Default Delivery Address</h2>
                      <p>Auto-fills Shopee-style when you open Checkout.</p>
                    </div>
                  </div>
                  <div className="account-form">
                    <div className="account-field">
                      <label htmlFor="addr-recipient">Recipient Full Name (Letters Only)</label>
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
                        <label htmlFor="addr-postal">ZIP / Postal Code (4 Digits)</label>
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
            <div className="account-settings-grid">
              <section className="account-setting-section account-setting-section--full">
                <div className="account-section-heading">
                  <span className="account-section-icon" aria-hidden="true">KEY</span>
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
                  <button type="submit" className="btn btn--secondary" disabled={passwordSaving}>
                    {passwordSaving ? 'Updating Password...' : 'Update Password'}
                  </button>
                </form>
              </section>

              <div className="account-logout-section">
                <div>
                  <h2>Sign Out</h2>
                  <p>Ends your current authenticated browser session cleanly.</p>
                </div>
                <button type="button" className="btn btn--secondary" onClick={handleLogout}>
                  Log Out
                </button>
              </div>

              <div className="account-danger-section">
                <div>
                  <h2>Delete Account</h2>
                  <p>
                    Permanently deletes your collector profile while preserving anonymized historical order records.
                  </p>
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

        {/* RIGHT COLUMN: SISO ARTISTIC SHOWCASE */}
        <aside className="account-auth-showcase" aria-label="SISO brand showcase">
          <div className="account-showcase-backdrop">
            <div className="account-showcase-sun" aria-hidden="true" />
            <div className="account-showcase-silhouette" aria-hidden="true">
              <svg viewBox="0 0 400 300" preserveAspectRatio="none" className="showcase-svg">
                <defs>
                  <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fde047" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#f472b6" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#312e81" stopOpacity="0.9" />
                  </linearGradient>
                  <linearGradient id="ridgeBack" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6d28d9" />
                    <stop offset="100%" stopColor="#3b0764" />
                  </linearGradient>
                  <linearGradient id="ridgeFront" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#e879f9" />
                    <stop offset="50%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#4c1d95" />
                  </linearGradient>
                  <linearGradient id="snowShelf" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
                    <stop offset="60%" stopColor="#ddd6fe" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.95" />
                  </linearGradient>
                </defs>
                {/* Distant Hills */}
                <path d="M0,160 Q120,110 240,150 T400,130 L400,300 L0,300 Z" fill="url(#ridgeBack)" opacity="0.75" />
                {/* Foreground Ridge Shelf */}
                <path d="M120,170 C220,140 320,160 400,185 L400,300 L120,300 Z" fill="url(#snowShelf)" />
                <path d="M0,210 C140,170 260,250 400,215 L400,300 L0,300 Z" fill="url(#ridgeFront)" opacity="0.9" />
                {/* Stylized Tree Silhouettes like in the user's reference */}
                <g stroke="#2e1065" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
                  {/* Tree 1 */}
                  <line x1="60" y1="260" x2="60" y2="200" strokeWidth="3" />
                  <line x1="60" y1="230" x2="48" y2="218" />
                  <line x1="60" y1="220" x2="72" y2="208" />
                  <line x1="60" y1="210" x2="52" y2="202" />
                  <line x1="60" y1="205" x2="66" y2="198" />
                  {/* Tree 2 */}
                  <line x1="95" y1="270" x2="95" y2="185" strokeWidth="3.5" />
                  <line x1="95" y1="240" x2="80" y2="225" />
                  <line x1="95" y1="230" x2="110" y2="212" />
                  <line x1="95" y1="215" x2="84" y2="200" />
                  <line x1="95" y1="200" x2="106" y2="190" />
                  <line x1="95" y1="190" x2="90" y2="180" />
                  {/* Tree 3 */}
                  <line x1="330" y1="265" x2="330" y2="195" strokeWidth="3" />
                  <line x1="330" y1="235" x2="318" y2="220" />
                  <line x1="330" y1="225" x2="342" y2="212" />
                  <line x1="330" y1="212" x2="322" y2="204" />
                </g>
              </svg>
            </div>
          </div>

          <div className="account-showcase-content">
            <div className="account-showcase-top">
              <span className="account-showcase-tag">SISO COLLECTIVE</span>
            </div>

            <div className="account-showcase-brand">
              <div className="account-showcase-logo-frame">
                <img
                  src="/assets/images/logo-mark.svg"
                  alt="SISO Squishies Logo"
                  className="account-showcase-logo-img"
                />
              </div>
              <h2 className="account-showcase-brand-name">SISO</h2>
              <span className="account-showcase-brand-sub">Squishies Collective</span>
            </div>

            <div className="account-showcase-footer">
              <h3 className="account-showcase-quote">
                Finally, all your squishies in one place.
              </h3>
              <p className="account-showcase-desc">
                Sensory tactile slow-rising toys crafted to soothe stress and spark joy.
              </p>

              <div className="account-showcase-controls">
                <div className="account-showcase-paddles" aria-hidden="true">
                  <span className="showcase-paddle">←</span>
                  <span className="showcase-paddle">→</span>
                </div>
                <div className="account-showcase-dots" aria-hidden="true">
                  <span className="dot is-active" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
