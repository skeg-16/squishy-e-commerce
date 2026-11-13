ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uidx ON users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uidx ON users (lower(email));

CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '12 hours'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS user_sessions_expires_idx ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS guest_sessions_expires_idx ON guest_sessions(expires_at);

CREATE INDEX IF NOT EXISTS orders_guest_created_idx ON orders(guest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_created_idx ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_created_desc_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS reservations_held_slug_idx ON reservations(product_slug) WHERE status = 'held';

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON admin_audit_logs(created_at DESC);

