# Squishies Storefront Design System (`DESIGN.md`)

## 1. Color Tokens

| Token | Value | Usage |
| :--- | :--- | :--- |
| `--color-cream` | `#fdf3ec` | Primary page background |
| `--color-cream-soft` | `#fff8f4` | Subtle card & surface background |
| `--color-pink` | `#ff6b95` | Primary brand accent & CTA buttons |
| `--color-pink-dark` | `#e8547d` | Primary CTA hover/active state |
| `--color-pink-light` | `#ffdae7` | Soft pink badges & highlights |
| `--color-navy` | `#2d1b3d` | Primary ink / typography & dark buttons |
| `--color-navy-soft` | `#5a4d68` | Secondary body copy & metadata |
| `--color-lavender` | `#c9aef1` | Secondary accent & bundle CTAs |
| `--color-lavender-light` | `#ece0fb` | Soft lavender badges & surfaces |
| `--color-mint` | `#93dcc4` | Positive / bestseller badges |
| `--color-mint-light` | `#d6f3e8` | Stock availability pill surface |
| `--color-peach` | `#ffa972` | Warm accent & bulk bundle CTA |
| `--color-peach-light` | `#ffe4cf` | Trending badge surface |
| `--color-purple-badge` | `#9b6df0` | Featured promo border & New Drop badge |
| `--color-white` | `#ffffff` | Card surface |
| `--color-border` | `#f0e3da` | Hairline card & section borders |
| `--bg-hero` | `#fdf1e7` | Hero section backdrop |
| `--bg-products` | `#fdf3ec` | Product catalog section backdrop |
| `--bg-promo` | `#fbeaf3` | Promo bundle section backdrop |

## 2. Font Pairing

- **Display / Headings (`--font-display`)**: `"Baloo 2", "Nunito", sans-serif` — rounded, tactile display weight (500–800) with tight line-height (`1.15`).
- **Body / UI (`--font-body`)**: `"Nunito", sans-serif` — clean, legible humanist sans-serif (400–800) with `1.5` line-height.

## 3. Spacing, Radii & Elevation Scale

- **Container Width (`--container-w`)**: `1180px` max-width with responsive horizontal padding.
- **Border Radii**:
  - `--radius-sm`: `10px` (inputs, steppers)
  - `--radius-md`: `18px` (product cards, promo cards)
  - `--radius-lg`: `28px` (hero media card, 3D product stage)
  - `--radius-pill`: `999px` (buttons, filter pills, badges, stock pills)
- **Shadows**:
  - `--shadow-card`: `0 12px 30px -14px rgba(45, 27, 61, 0.18)`
  - `--shadow-btn`: `0 8px 18px -6px rgba(255, 107, 149, 0.55)`

## 4. Component Inventory

- **`Header` (`src/components/Header.jsx`)**: Sticky navigation bar with brand mark, primary links (`Home`, `Shop`, `About`), `Shop Now` CTA, and cart drawer trigger with item count badge.
- **`CartDrawer` (`src/components/CartDrawer.jsx`)**: Slide-over dialog with line items, quantity steppers, free-shipping progress bar (`₱500` threshold), and checkout navigation.
- **`Home` (`src/pages/Home.jsx`)**: Hero showcase, "Most Squeezed" featured product grid (3-column desktop), and "Promo Sets" bundle grid (4-column desktop).
- **`Shop` (`src/pages/Shop.jsx`)**: Search input, category filter pills (`All`, `Food`, `Animal`), and 3-column responsive product card grid with `View Item` and `+ Cart` actions.
- **`Product` (`src/pages/Product.jsx`)**: Breadcrumb bar, interactive 3D GLTF model stage (`ProductViewer3D`) with SVG fallback, rating summary, stock pill, quantity stepper, `Add to Cart` / `Buy it now` CTAs, specifications table, FAQ accordion, and verified buyer reviews.
- **`ProductViewer3D` (`src/components/ProductViewer3D.jsx`)**: Three.js / React Three Fiber canvas with normalized bounding-box centering, local studio environment lighting (`RoomEnvironment`), auto-rotating `OrbitControls`, and WebGL error fallback.
- **`Checkout` (`src/pages/Checkout.jsx`)**: Regional shipping selector, voucher code applicator (`WELCOME10`, `FREESHIP`, `SQUISHY50`), payment method selector (`COD`, `GCash`, `Maya`, `Card`), payment simulation modal, order status tracker, and verified review submission.
