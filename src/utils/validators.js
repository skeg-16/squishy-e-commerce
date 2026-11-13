/**
 * Strict frontend input sanitizers and field validators mirroring server/validation.js.
 * Prevents invalid characters from entering phone, zip/postal code, card, OTP/MPIN,
 * name, city, and username inputs both while typing/pasting and on form submission.
 */

export const FIELD_LIMITS = {
  name: 60,
  email: 80,
  phone: 11,
  address: 100,
  city: 50,
  barangay: 50,
  postalCode: 4,
  orderNote: 200,
  username: 28,
  voucherCode: 30,
};

export const PERSON_NAME_REGEX = /^[A-Za-zÀ-ÿ]+(?:[ '\-.][A-Za-zÀ-ÿ]+)*$/;
export const CITY_NAME_REGEX = /^[A-Za-zÀ-ÿ]+(?:[ '\-.][A-Za-zÀ-ÿ]+)*$/;
export const BARANGAY_NAME_REGEX = /^[A-Za-zÀ-ÿ0-9.,#'()/\- ]+$/;
export const USERNAME_REGEX = /^[A-Za-z0-9_]{3,28}$/;
export const PH_MOBILE_REGEX = /^09\d{9}$/;
export const PH_POSTAL_REGEX = /^\d{4}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Keeps only ASCII digits up to maxLen.
 * Used for PH phone numbers, ZIP/postal codes, OTPs, MPINs, card digits, and CVVs.
 */
export function sanitizeDigits(value, maxLen = 32) {
  return String(value ?? '')
    .replace(/\D+/g, '')
    .slice(0, maxLen);
}

/**
 * Normalizes Philippine mobile inputs typed or pasted (+639... / 639... / 09...)
 * into strict digits only (up to 11 digits). Letters and symbols are stripped immediately.
 */
export function sanitizePhPhone(value) {
  const raw = String(value ?? '').trim();
  let digits = raw.replace(/\D+/g, '');
  if (digits.startsWith('63') && digits.length >= 11) {
    digits = `0${digits.slice(2)}`;
  } else if (digits.startsWith('9') && digits.length === 10) {
    digits = `0${digits}`;
  }
  return digits.slice(0, FIELD_LIMITS.phone);
}

/**
 * Strips numbers and disallowed special characters from person names,
 * capping length at 60 characters.
 */
export function sanitizePersonName(value, maxLen = FIELD_LIMITS.name) {
  return String(value ?? '')
    .replace(/[^A-Za-zÀ-ÿ '\-.]/g, '')
    .replace(/^\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, maxLen);
}

/**
 * Strips whitespace from email inputs and caps length at 80 characters.
 */
export function sanitizeEmail(value, maxLen = FIELD_LIMITS.email) {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .slice(0, maxLen);
}

/**
 * Sanitizes street address inputs and caps length at 100 characters.
 */
export function sanitizeStreetAddress(value, maxLen = FIELD_LIMITS.address) {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/^\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, maxLen);
}

/**
 * Strips disallowed symbols/numbers from city/municipality inputs and caps at 50 chars.
 */
export function sanitizeCityName(value, maxLen = FIELD_LIMITS.city) {
  return String(value ?? '')
    .replace(/[^A-Za-zÀ-ÿ '\-.]/g, '')
    .replace(/^\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, maxLen);
}

/**
 * Strips disallowed symbols from barangay inputs and caps at 50 chars.
 */
export function sanitizeBarangayName(value, maxLen = FIELD_LIMITS.barangay) {
  return String(value ?? '')
    .replace(/[^A-Za-zÀ-ÿ0-9.,#'()/\- ]/g, '')
    .replace(/^\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, maxLen);
}

/**
 * Restricts usernames strictly to ASCII letters, digits, and underscores.
 */
export function sanitizeUsername(value, maxLen = FIELD_LIMITS.username) {
  return String(value ?? '')
    .replace(/[^A-Za-z0-9_]/g, '')
    .slice(0, maxLen);
}

/**
 * Formats 16-digit card number cleanly in groups of 4 while stripping non-digits.
 */
export function formatCardNumber(value) {
  const digits = sanitizeDigits(value, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/**
 * Formats MM/YY card expiry cleanly while stripping non-digits.
 */
export function formatCardExpiry(value) {
  const digits = sanitizeDigits(value, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/**
 * Evaluates password strength for real-time meter feedback.
 */
export function getPasswordStrength(password = '') {
  const value = String(password || '');
  const checks = {
    minLength: value.length >= 8,
    hasUpper: /[A-Z]/.test(value),
    hasLower: /[a-z]/.test(value),
    hasDigit: /\d/.test(value),
    hasSymbol: /[^A-Za-z0-9]/.test(value),
  };
  const score = Object.values(checks).filter(Boolean).length;
  let label = 'Too weak';
  let tone = 'weak';
  if (value.length === 0) {
    label = 'Enter password';
    tone = 'idle';
  } else if (score <= 2 || !checks.minLength) {
    label = 'Weak';
    tone = 'weak';
  } else if (score === 3) {
    label = 'Fair';
    tone = 'fair';
  } else if (score === 4) {
    label = 'Good';
    tone = 'good';
  } else {
    label = 'Strong';
    tone = 'strong';
  }
  return { score, label, tone, checks };
}

export function validateEmail(value) {
  const v = String(value ?? '').trim();
  if (!v) return 'Email address is required.';
  if (v.length > FIELD_LIMITS.email) return `Email address cannot exceed ${FIELD_LIMITS.email} characters.`;
  if (!EMAIL_REGEX.test(v)) return 'Enter a valid email address (e.g., name@domain.com).';
  return '';
}

export function validatePhPhone(value) {
  const v = String(value ?? '').trim();
  if (!v) return 'Mobile number is required.';
  if (!/^\d+$/.test(v)) return 'Mobile number must contain digits only.';
  if (!PH_MOBILE_REGEX.test(v)) return 'Enter a valid 11-digit PH mobile number starting with 09.';
  return '';
}

export function validatePostalCode(value) {
  const v = String(value ?? '').trim();
  if (!v) return 'Postal / ZIP code is required.';
  if (!/^\d+$/.test(v)) return 'Postal / ZIP code must contain digits only.';
  if (!PH_POSTAL_REGEX.test(v) || v === '0000') {
    return 'Enter a valid 4-digit PH postal code (e.g., 1000).';
  }
  return '';
}

export function validateBirthday(value) {
  const v = String(value ?? '').trim();
  if (!v) return 'Birthday is required.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Use YYYY-MM-DD format.';
  const date = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== v) {
    return 'Enter a valid calendar date.';
  }
  const now = new Date();
  const minDate = new Date(Date.UTC(now.getUTCFullYear() - 120, 0, 1));
  const maxDate = new Date(Date.UTC(now.getUTCFullYear() - 13, now.getUTCMonth(), now.getUTCDate()));
  if (date < minDate || date > maxDate) {
    return 'Collectors must be at least 13 years old.';
  }
  return '';
}

export function validateCheckoutFields(form) {
  const errors = {};
  const name = String(form.name ?? '').trim();
  const email = String(form.email ?? '').trim();
  const phone = String(form.phone ?? '').trim();
  const address = String(form.address ?? '').trim();
  const city = String(form.city ?? '').trim();
  const barangay = String(form.barangay ?? '').trim();
  const postalCode = String(form.postalCode ?? '').trim();

  if (name.length < 2) errors.name = 'Full name is required (at least 2 letters).';
  else if (name.length > FIELD_LIMITS.name) errors.name = `Full name cannot exceed ${FIELD_LIMITS.name} characters.`;
  else if (!PERSON_NAME_REGEX.test(name)) errors.name = 'Use letters only for recipient full name.';

  const phoneErr = validatePhPhone(phone);
  if (phoneErr) errors.phone = phoneErr;

  const emailErr = validateEmail(email);
  if (emailErr) errors.email = emailErr;

  if (address.length < 5) errors.address = 'Enter a complete street, unit, or house number (min 5 chars).';
  else if (address.length > FIELD_LIMITS.address) errors.address = `Street address cannot exceed ${FIELD_LIMITS.address} characters.`;
  else if (!/[A-Za-z0-9]{2,}/.test(address)) errors.address = 'Enter a valid street address.';

  if (city.length < 2) errors.city = 'City / Municipality is required.';
  else if (city.length > FIELD_LIMITS.city) errors.city = `City / Municipality cannot exceed ${FIELD_LIMITS.city} characters.`;
  else if (!CITY_NAME_REGEX.test(city)) errors.city = 'Enter a valid city name (letters only).';

  if (barangay.length < 2) errors.barangay = 'Barangay is required.';
  else if (barangay.length > FIELD_LIMITS.barangay) errors.barangay = `Barangay cannot exceed ${FIELD_LIMITS.barangay} characters.`;
  else if (!BARANGAY_NAME_REGEX.test(barangay)) errors.barangay = 'Enter a valid barangay name.';

  const postalErr = validatePostalCode(postalCode);
  if (postalErr) errors.postalCode = postalErr;

  return errors;
}

export function validateRegisterFields(form) {
  const errors = {};
  const username = String(form.username ?? '').trim();
  const emailErr = validateEmail(form.email);
  const phoneErr = validatePhPhone(form.phone);
  const birthdayErr = validateBirthday(form.birthday);
  const password = String(form.password ?? '');
  const confirmPassword = String(form.confirmPassword ?? '');

  if (!USERNAME_REGEX.test(username)) {
    errors.username = 'Username must be 3–28 characters (letters, numbers, underscores only).';
  }
  if (emailErr) errors.email = emailErr;
  if (phoneErr) errors.phone = phoneErr;
  if (birthdayErr) errors.birthday = birthdayErr;

  const strength = getPasswordStrength(password);
  if (!strength.checks.minLength || !strength.checks.hasUpper || !strength.checks.hasLower || !strength.checks.hasDigit) {
    errors.password = 'Use 8+ chars with uppercase, lowercase, and at least one number.';
  }
  if (confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  return errors;
}

export function validateResetPasswordFields(form) {
  const errors = {};
  const username = String(form.username ?? '').trim();
  if (!USERNAME_REGEX.test(username)) {
    errors.username = 'Enter your valid account username.';
  }
  const emailErr = validateEmail(form.email);
  if (emailErr) errors.email = emailErr;

  const birthdayErr = validateBirthday(form.birthday);
  if (birthdayErr) errors.birthday = birthdayErr;

  const strength = getPasswordStrength(form.newPassword);
  if (!strength.checks.minLength || !strength.checks.hasUpper || !strength.checks.hasLower || !strength.checks.hasDigit) {
    errors.newPassword = 'Use 8+ chars with uppercase, lowercase, and at least one number.';
  }
  if (form.confirmPassword !== form.newPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  return errors;
}

export function validateProfileFields(form, { withAddress = false } = {}) {
  const errors = {};
  const username = String(form.username ?? '').trim();
  if (!USERNAME_REGEX.test(username)) {
    errors.username = 'Username must be 3–28 characters (letters, numbers, underscores only).';
  }
  const emailErr = validateEmail(form.email);
  if (emailErr) errors.email = emailErr;

  const phoneErr = validatePhPhone(form.phone);
  if (phoneErr) errors.phone = phoneErr;

  const birthdayErr = validateBirthday(form.birthday);
  if (birthdayErr) errors.birthday = birthdayErr;

  if (withAddress) {
    const addr = form.defaultAddress || {};
    const recipientName = String(addr.recipientName ?? '').trim();
    const addrPhone = String(addr.phone ?? '').trim();
    const shippingAddress = String(addr.shippingAddress ?? '').trim();
    const city = String(addr.city ?? '').trim();
    const barangay = String(addr.barangay ?? '').trim();
    const postalCode = String(addr.postalCode ?? '').trim();

    if (recipientName) {
      if (recipientName.length < 2) {
        errors['defaultAddress.recipientName'] = 'Recipient name must be at least 2 letters.';
      } else if (recipientName.length > FIELD_LIMITS.name) {
        errors['defaultAddress.recipientName'] = `Recipient name cannot exceed ${FIELD_LIMITS.name} characters.`;
      } else if (!PERSON_NAME_REGEX.test(recipientName)) {
        errors['defaultAddress.recipientName'] = 'Use letters only for recipient name.';
      }
    }
    if (addrPhone) {
      const pErr = validatePhPhone(addrPhone);
      if (pErr) errors['defaultAddress.phone'] = pErr;
    }
    if (shippingAddress.length < 5) {
      errors['defaultAddress.shippingAddress'] = 'Complete street address is required (min 5 chars).';
    } else if (shippingAddress.length > FIELD_LIMITS.address) {
      errors['defaultAddress.shippingAddress'] = `Street address cannot exceed ${FIELD_LIMITS.address} characters.`;
    }
    if (city.length < 2 || city.length > FIELD_LIMITS.city || !CITY_NAME_REGEX.test(city)) {
      errors['defaultAddress.city'] = 'Enter a valid city / municipality (letters only, max 50 chars).';
    }
    if (barangay.length < 2 || barangay.length > FIELD_LIMITS.barangay || !BARANGAY_NAME_REGEX.test(barangay)) {
      errors['defaultAddress.barangay'] = 'Enter a valid barangay (max 50 chars).';
    }
    const zipErr = validatePostalCode(postalCode);
    if (zipErr) errors['defaultAddress.postalCode'] = zipErr;
  }

  return errors;
}

/**
 * Smoothly scrolls the viewport to the first invalid form field, focuses it,
 * and triggers a brief visual attention pulse so the user immediately sees
 * which field prevented form submission.
 */
export function scrollToFirstInvalidField(
  errorsObj = {},
  fieldOrder = [],
  fieldIdMap = {},
  fallbackSelector = '[role="alert"]'
) {
  if (typeof document === 'undefined') return;
  const errorKeys = Object.keys(errorsObj).filter((k) => Boolean(errorsObj[k]));
  const orderedKey =
    fieldOrder.find((key) => errorKeys.includes(key)) || errorKeys[0] || null;

  const scheduleFocusAndScroll = () => {
    let targetEl = null;
    if (orderedKey) {
      const domId = fieldIdMap[orderedKey] || orderedKey;
      targetEl =
        document.getElementById(domId) ||
        document.querySelector(`[name="${orderedKey}"]`);
    }
    if (!targetEl && fallbackSelector) {
      targetEl = document.querySelector(fallbackSelector);
    }
    if (!targetEl) return;

    const fieldContainer =
      targetEl.closest('.form-field, .account-field') || targetEl;

    fieldContainer.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });

    if (typeof targetEl.focus === 'function') {
      try {
        targetEl.focus({ preventScroll: true });
      } catch {
        targetEl.focus();
      }
    }

    fieldContainer.classList.remove('is-error-attention');
    // Force reflow so repeated clicks re-trigger the animation
    void fieldContainer.offsetWidth;
    fieldContainer.classList.add('is-error-attention');
    setTimeout(() => {
      fieldContainer.classList.remove('is-error-attention');
    }, 1400);
  };

  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(scheduleFocusAndScroll);
  } else {
    setTimeout(scheduleFocusAndScroll, 0);
  }
}

