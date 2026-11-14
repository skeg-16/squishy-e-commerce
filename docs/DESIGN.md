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
| `--bg-hero` | `linear-gradient(115deg, #c88fb8 0%, #a77a9f 35%, #8d79a2 60%, #6c7fa8 100%)` | Interactive soft-body hero backdrop |
| `--hero-headline-accent` | `#ffc4de` | Staggered second-line headline & checklist circles |
| `--hero-plum` | `#5b3358` | Headline text shadow & checklist check mark stroke |
| `--hero-cta-gradient` | `linear-gradient(180deg, #f58fc0, #d96aa3)` | Hero primary pill CTA ("Pick your squish") |
| `--char-dumpling` | `#fff5eb` / `#fde2ca` / `#e5bc96` | Steamed Dumpling soft-body radial gradient stops |
| `--char-cheese` | `#fff3a8` / `#f9d857` / `#d9a726` | Cheese Cube soft-body radial gradient stops |
| `--char-catpaw` | `#fff7fb` / `#ffd6e7` / `#e89ab8` | Cat Paw soft-body radial gradient stops |
| `--char-toast` | `#fff2d6` / `#f9d49b` / `#cf9855` | Pastel Toast soft-body radial gradient stops |
| `--char-butter` | `#fff9db` / `#ffebb0` / `#dfc059` | Butter Stick soft-body radial gradient stops |
| `--char-peanut` | `#f7e3c4` / `#e0bc89` / `#b58850` | Peanut soft-body radial gradient stops |
| `--bg-products` | `#fdf3ec` | Product catalog section backdrop |
| `--bg-promo` | `#fbeaf3` | Promo bundle section backdrop |

## 2. Font Pairing

- **Hero Display & Callouts (`--font-hero`)**: `"Fredoka", sans-serif` — weights `500`, `600`, `700`; used for the interactive jelly-ripple headline (`clamp(2.9rem, 9vw, 8rem)`, line-height `0.95`), CTA button, canvas callout titles, and stress percentage gauge.
- **Display / Headings (`--font-display`)**: `"Baloo 2", "Nunito", sans-serif` — rounded, tactile display weight (500–800) with tight line-height (`1.15`).
- **Body / UI (`--font-body`)**: `"Nunito", sans-serif` — clean, legible humanist sans-serif (400–800) with `1.5`–`1.6` line-height.

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

- **`Header` (`src/components/Header.jsx`)**: Floating "Frosted Jelly Dock" capsule header (`header__dock`) with plum-rose-lavender iridescent glass, brand badge (`Squishies` + `3D Soft-Rise` tag), recessed pill navigation track (`Home`, `Shop`, `About`) with custom vector icons and glowing active capsule, glossy `Shop Now` CTA, glass `Bag` cart trigger with pink count orb, and frosted `Log-in` capsule.
- **`CartDrawer` (`src/components/CartDrawer.jsx`)**: Slide-over dialog with line items, quantity steppers, free-shipping progress bar (`₱500` threshold), and checkout navigation.
- **`Home` (`src/pages/Home.jsx`)**:
  - **Hero Section**: Full-width interactive Three.js / WebGL 3D soft-body hero (`clamp(680px, 94vh, 880px)` desktop, `860px` mobile `<860px`) combining a real-time 3D deformable superellipsoid mesh (`THREE.MeshPhysicalMaterial` with studio `RoomEnvironment`, clearcoat, velvet sheen, 3D cursor tilt, and 3D radial vertex denting on press) with a synchronized 2D HUD overlay for desktop anatomy callouts, sparkle particles, and speech bubbles across all 6 store-product characters (`Dumpling`, `Cheese Cube`, `Cat Paw`, `Pastel Toast`, `Butter Stick`, `Peanut`) with distinct cute neural voices (`public/assets/voices/*.mp3`) and vertical stress tube gauge.
  - **Most Squeezed — Interactive 3D Showroom (`#shop`)**: Live interactive Three.js / WebGL 3D product stage cards (`ProductViewer3D`) with a 3D lineup switcher (`Top 3 Favorites` vs `Toast, Butter & Dumpling`), interactive 3D squish-on-press physics, tactile sensory spec pills (`Rise Time`, `Softness`, `Texture`), softness meter bars, and quick-add cart actions.
  - **Promo Sets — Interactive Unbox & Value Showcase (`#promo`)**: Interactive bundle vibe-matcher filter bar, visual gift-box preview stages inside each card showing floating bundle items and per-squish unit pricing (`₱89/pc` down to `₱70/pc`), savings badges, and curated bundle checklist items.
- **`Shop` (`src/pages/Shop.jsx`)**:
  - **3D Spotlight Carousel Stage ("The Squish Runway")**: Wide frosted-jelly hero carousel featuring a large interactive 3D viewport (`ProductViewer3D` with `scaleBoost={1.18}`) on the left with character-matched radial aura glow, interactive `Squish 3D` trigger with cute voice lines, Prev/Next glass navigation paddles, and a 6-character thumbnail switcher dock at the bottom; paired on the right with edition badge (`#01 / 06`), flavor/scent chips, 3-axis Squish-o-Meter telemetry (`Cloud Softness`, `Slow-Rise Recovery`, `Stress Relief Score`), quantity stepper, and `Add to Bag` / `Open 3D Studio` CTAs.
  - **Interactive 3D Showroom Catalog Grid**: Search input, category filter pills (`All`, `Food`, `Animal`, `Sweet Bakery`, `Savory`), layout density toggle (`Showcase 2-Up` vs `Gallery 3-Up`), oversized 3D product cards (`ProductViewer3D compact` with `.glb` models, radial pedestal, `Squish 3D` button, sensory chips, softness progress bar, and bold pricing), and `<PaginationBar>`.
- **`Product` (`src/pages/Product.jsx`)**: Breadcrumb bar, interactive 3D GLTF model stage (`ProductViewer3D`) with SVG fallback, rating summary, stock pill, quantity stepper, `Add to Cart` / `Buy it now` CTAs, specifications table, FAQ accordion, and verified buyer reviews.
- **`ProductViewer3D` (`src/components/ProductViewer3D.jsx`)**: Three.js / React Three Fiber canvas with normalized bounding-box centering, local studio environment lighting (`RoomEnvironment`), auto-rotating `OrbitControls`, and WebGL error fallback.
- **`Checkout` (`src/pages/Checkout.jsx`)**: Regional shipping selector, voucher code applicator (`WELCOME10`, `FREESHIP`, `SQUISHY50`), payment method selector (`COD`, `GCash`, `Maya`, `Card`), payment simulation modal, order status tracker, and verified review submission.
- **`Account` (`src/pages/Account.jsx`)**: Split-card aesthetic authentication hub (`account-auth-split`). Features a clean 2-column layout on desktop (>880px) and a focused single-column card on mobile (<=880px). Left pane contains high-readability form fields (`border-radius: 14px`, high-contrast typography, inline error feedback, eye toggle visibility for passwords, and segmented pill tabs). Right pane features **ONLY** the official SISO logo mark, rendered large and bold inside an original aesthetic glassmorphism frame with ambient glow, subtle floating animation, and theme-matching palette (no decorative scenic background, mountains, quotes, or extraneous controls). On mobile views, the right-side logo is cleanly hidden (`display: none;`) to prevent vertical bloat, and the form pane seamlessly expands to 100% with no empty gaps or awkward margins.

## 5. Site-Wide Responsive Architecture (Mobile-First Polish)

- **Mobile Viewport Strategy (<768px & <880px)**:
  - Eliminate endless vertical scrolling by utilizing compact 2-column product grids, horizontal card carousels, collapsible accordions for secondary content, and tabbed interfaces.
  - Apply fluid typography with `clamp()` to maintain proportional scale across 360px–1440px displays.
  - Maintain touch accessibility: minimum 44px tap targets for all clickable triggers, steppers, and navigation items.
  - Generous tap padding with reduced vertical margin to keep viewports clean, dense, and engaging without feeling cramped.


