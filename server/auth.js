const { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } = require('node:crypto');
const { transaction } = require('./db');
const { fail } = require('./errors');

const digest = (value) => createHash('sha256').update(String(value)).digest('hex');

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  const actualBuf = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(actualBuf, expectedBuf);
}

function serializeUser(row) {
  if (!row) return null;
  let bday = '';
  if (row.birthday instanceof Date) {
    const y = row.birthday.getFullYear();
    const m = String(row.birthday.getMonth() + 1).padStart(2, '0');
    const d = String(row.birthday.getDate()).padStart(2, '0');
    bday = `${y}-${m}-${d}`;
  } else if (row.birthday) {
    bday = String(row.birthday).slice(0, 10);
  }
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    phone: row.phone || '',
    birthday: bday,
    role: row.role || 'customer',
    active: row.active !== false,
    defaultAddress:
      row.default_address &&
      typeof row.default_address === 'object' &&
      Object.keys(row.default_address).length > 0
        ? row.default_address
        : null,
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

function createAuth(pool) {
  async function resolveUser(token) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const { rows: [user] } = await pool.query(
      `SELECT u.*
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.expires_at > clock_timestamp()
         AND COALESCE(u.active, true) = true`,
      [digest(token)]
    );
    return serializeUser(user);
  }

  async function issueSession(q, userId) {
    const token = randomBytes(32).toString('hex');
    await q.query(
      `INSERT INTO user_sessions(id, user_id, token_hash) VALUES($1, $2, $3)`,
      [randomUUID(), userId, digest(token)]
    );
    return token;
  }

  async function claimGuestOrders(q, userId, email, guestId) {
    if (!guestId && !email) return;
    if (guestId) {
      await q.query(
        `UPDATE orders
         SET user_id = $1
         WHERE user_id IS NULL
           AND (guest_id = $2 OR lower(COALESCE(customer->>'customerEmail', '')) = lower($3))`,
        [userId, guestId, email || '']
      );
    } else if (email) {
      await q.query(
        `UPDATE orders
         SET user_id = $1
         WHERE user_id IS NULL
           AND lower(COALESCE(customer->>'customerEmail', '')) = lower($2)`,
        [userId, email]
      );
    }
  }

  async function register(input, guestId = null) {
    return transaction(pool, async (q) => {
      const { rows: dupUsername } = await q.query(
        'SELECT 1 FROM users WHERE lower(username) = lower($1)',
        [input.username]
      );
      if (dupUsername.length) {
        fail(409, 'USERNAME_TAKEN', 'This username is already taken.', {
          username: 'Choose a different username.',
        });
      }

      const { rows: dupEmail } = await q.query(
        'SELECT 1 FROM users WHERE lower(email) = lower($1)',
        [input.email]
      );
      if (dupEmail.length) {
        fail(409, 'EMAIL_TAKEN', 'An account with this email already exists.', {
          email: 'Try logging in or use another email address.',
        });
      }

      const userId = randomUUID();
      const passwordHash = hashPassword(input.password);
      const { rows: [created] } = await q.query(
        `INSERT INTO users(id, username, email, password_hash, phone, birthday, role, active, last_login_at)
         VALUES($1, $2, $3, $4, $5, $6, 'customer', true, clock_timestamp())
         RETURNING *`,
        [userId, input.username, input.email.toLowerCase(), passwordHash, input.phone, input.birthday]
      );

      await claimGuestOrders(q, userId, created.email, guestId);
      const token = await issueSession(q, userId);
      return { user: serializeUser(created), token };
    });
  }

  async function login(input, guestId = null) {
    const { rows: [row] } = await pool.query(
      `SELECT * FROM users
       WHERE lower(username) = lower($1) OR lower(email) = lower($1)`,
      [input.identifier.trim()]
    );

    if (!row || !verifyPassword(input.password, row.password_hash)) {
      fail(401, 'INVALID_CREDENTIALS', 'Invalid username/email or password.', {
        password: 'Check your credentials and try again.',
      });
    }

    if (row.active === false) {
      fail(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended by the store administrator.', {
        identifier: 'Account is currently suspended.',
      });
    }

    return transaction(pool, async (q) => {
      await claimGuestOrders(q, row.id, row.email, guestId);
      await q.query(
        `DELETE FROM user_sessions WHERE user_id = $1 AND expires_at <= clock_timestamp()`,
        [row.id]
      );
      const { rows: [updated] } = await q.query(
        `UPDATE users SET last_login_at = clock_timestamp() WHERE id = $1 RETURNING *`,
        [row.id]
      );
      const token = await issueSession(q, row.id);
      return { user: serializeUser(updated || row), token };
    });
  }

  async function logout(token) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return;
    await pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [digest(token)]);
  }

  async function resetPassword(input) {
    return transaction(pool, async (q) => {
      const { rows: [user] } = await q.query(
        `SELECT * FROM users
         WHERE lower(username) = lower($1)
           AND lower(email) = lower($2)
           AND birthday = $3::date
         FOR UPDATE`,
        [input.username, input.email, input.birthday]
      );

      if (!user) {
        fail(404, 'IDENTITY_MISMATCH', 'No account matched that username, email, and birthday combination.');
      }

      if (user.active === false) {
        fail(403, 'ACCOUNT_SUSPENDED', 'This account is suspended and cannot reset its password.');
      }

      const nextHash = hashPassword(input.newPassword);
      await q.query(
        `UPDATE users SET password_hash = $2, updated_at = clock_timestamp() WHERE id = $1`,
        [user.id, nextHash]
      );
      await q.query('DELETE FROM user_sessions WHERE user_id = $1', [user.id]);
      await q.query('DELETE FROM admin_sessions WHERE user_id = $1', [user.id]);
      return { updated: true };
    });
  }

  async function updateProfile(userId, input, guestId = null) {
    return transaction(pool, async (q) => {
      const { rows: dupUsername } = await q.query(
        'SELECT 1 FROM users WHERE lower(username) = lower($1) AND id <> $2',
        [input.username, userId]
      );
      if (dupUsername.length) {
        fail(409, 'USERNAME_TAKEN', 'This username is already taken.', {
          username: 'Choose another username.',
        });
      }

      const { rows: dupEmail } = await q.query(
        'SELECT 1 FROM users WHERE lower(email) = lower($1) AND id <> $2',
        [input.email, userId]
      );
      if (dupEmail.length) {
        fail(409, 'EMAIL_TAKEN', 'Another account already uses this email.', {
          email: 'Choose another email.',
        });
      }

      const shouldClearAddress = input.defaultAddress === null;
      const shouldUpdateAddress = input.defaultAddress !== undefined && input.defaultAddress !== null;

      const { rows: [updated] } = await q.query(
        `UPDATE users
         SET username = $2,
             email = $3,
             phone = $4,
             birthday = $5::date,
             default_address = CASE
               WHEN $6::boolean THEN '{}'::jsonb
               WHEN $7::jsonb IS NOT NULL THEN $7::jsonb
               ELSE default_address
             END,
             updated_at = clock_timestamp()
         WHERE id = $1
         RETURNING *`,
        [
          userId,
          input.username,
          input.email.toLowerCase(),
          input.phone,
          input.birthday,
          shouldClearAddress,
          shouldUpdateAddress ? JSON.stringify(input.defaultAddress) : null,
        ]
      );

      if (!updated) fail(404, 'NOT_FOUND', 'Account not found.');
      await claimGuestOrders(q, userId, updated.email, guestId);
      return serializeUser(updated);
    });
  }

  async function changePassword(userId, input, currentToken = null) {
    return transaction(pool, async (q) => {
      const { rows: [user] } = await q.query(
        'SELECT * FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );
      if (!user) fail(404, 'NOT_FOUND', 'Account not found.');
      if (!verifyPassword(input.currentPassword, user.password_hash)) {
        fail(401, 'INVALID_PASSWORD', 'Your current password is incorrect.', {
          currentPassword: 'Enter your exact current password.',
        });
      }
      await q.query(
        'UPDATE users SET password_hash = $2, updated_at = clock_timestamp() WHERE id = $1',
        [userId, hashPassword(input.newPassword)]
      );
      // Revoke all other active sessions for this user while keeping current session active
      if (currentToken && /^[a-f0-9]{64}$/.test(currentToken)) {
        await q.query(
          'DELETE FROM user_sessions WHERE user_id = $1 AND token_hash <> $2',
          [userId, digest(currentToken)]
        );
      }
      return { updated: true };
    });
  }

  async function deleteAccount(userId, input) {
    return transaction(pool, async (q) => {
      const { rows: [user] } = await q.query(
        'SELECT * FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );
      if (!user) fail(404, 'NOT_FOUND', 'Account not found.');
      if (!verifyPassword(input.password, user.password_hash)) {
        fail(401, 'INVALID_PASSWORD', 'Password confirmation failed.', {
          password: 'Enter your current password to delete your account.',
        });
      }
      await q.query('DELETE FROM users WHERE id = $1', [userId]);
      return { deleted: true };
    });
  }

  return {
    resolveUser,
    register,
    login,
    logout,
    resetPassword,
    updateProfile,
    changePassword,
    deleteAccount,
  };
}

module.exports = { createAuth, hashPassword, verifyPassword, serializeUser };
