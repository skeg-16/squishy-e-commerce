CREATE TABLE products (
  slug text PRIMARY KEY, name text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('single','bundle')),
  price_minor integer NOT NULL CHECK (price_minor >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active boolean NOT NULL DEFAULT true, content jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE bundle_components (
  bundle_slug text NOT NULL REFERENCES products(slug), product_slug text NOT NULL REFERENCES products(slug),
  quantity integer NOT NULL CHECK (quantity > 0), PRIMARY KEY(bundle_slug,product_slug), CHECK(bundle_slug <> product_slug)
);
CREATE TABLE guest_sessions (
  id uuid PRIMARY KEY, token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '30 days')
);
CREATE TABLE vouchers (
  code text PRIMARY KEY, type text NOT NULL CHECK (type IN ('percentage','fixed_amount','free_shipping')),
  value integer NOT NULL CHECK (value >= 0), min_spend_minor integer NOT NULL DEFAULT 0 CHECK (min_spend_minor >= 0),
  active boolean NOT NULL DEFAULT true, description text NOT NULL
);
CREATE TABLE quotes (
  id uuid PRIMARY KEY, guest_id uuid NOT NULL REFERENCES guest_sessions(id), request jsonb NOT NULL,
  pricing jsonb NOT NULL, fingerprint text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '5 minutes')
);
CREATE TABLE orders (
  id uuid PRIMARY KEY, order_number text NOT NULL UNIQUE, guest_id uuid NOT NULL REFERENCES guest_sessions(id),
  quote_id uuid NOT NULL UNIQUE REFERENCES quotes(id), idempotency_key text NOT NULL, request_hash text NOT NULL,
  customer jsonb NOT NULL, payment_method text NOT NULL CHECK (payment_method IN ('cod','gcash','maya','card')),
  status text NOT NULL CHECK (status IN ('To Pay','To Ship','Shipped','Completed','Cancelled','Expired')),
  payment_status text NOT NULL CHECK (payment_status IN ('Unpaid','Pending COD','Paid','Refunded')),
  pricing jsonb NOT NULL, tracking_number text NOT NULL UNIQUE, expires_at timestamptz,
  payment_reference text, cancellation_reason text, paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(guest_id,idempotency_key)
);
CREATE INDEX orders_expiration ON orders(expires_at) WHERE status = 'To Pay';
CREATE TABLE order_items (
  order_id uuid NOT NULL REFERENCES orders(id), product_slug text NOT NULL REFERENCES products(slug),
  product_name text NOT NULL, quantity integer NOT NULL CHECK (quantity > 0),
  price_minor integer NOT NULL CHECK (price_minor >= 0), PRIMARY KEY(order_id,product_slug)
);
CREATE TABLE reservations (
  order_id uuid NOT NULL REFERENCES orders(id), product_slug text NOT NULL REFERENCES products(slug),
  quantity integer NOT NULL CHECK (quantity > 0), status text NOT NULL CHECK (status IN ('held','committed','released')),
  PRIMARY KEY(order_id,product_slug)
);
CREATE TABLE payment_attempts (
  id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id), idempotency_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','success','declined','cancelled','expired')),
  amount_minor integer NOT NULL CHECK (amount_minor >= 0), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(order_id,idempotency_key)
);
CREATE UNIQUE INDEX one_pending_payment ON payment_attempts(order_id) WHERE status='pending';
CREATE TABLE order_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id),
  status text NOT NULL, description text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE reviews (
  id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id), product_slug text NOT NULL REFERENCES products(slug),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5), comment text NOT NULL CHECK (length(comment) BETWEEN 3 AND 1000),
  reviewer_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(order_id,product_slug)
);
CREATE INDEX reviews_product ON reviews(product_slug,created_at);
CREATE TABLE rate_limits (bucket text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);
