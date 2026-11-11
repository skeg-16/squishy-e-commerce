import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SquishiesAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { FALLBACK_PRODUCTS } from '../data/catalogFallback';
import { PRODUCT_MODELS } from '../data/productModels';
import PaginationBar from '../components/PaginationBar';

const ProductViewer3D = lazy(() => import('../components/ProductViewer3D'));

const shopProducts = [
  {
    slug: 'dumpling',
    edition: '01',
    name: 'Steamed Dumpling Squishy',
    shortName: 'Dumpling',
    category: 'food',
    subTag: 'savory',
    description: 'Pastel bao with a happy face & pleated crown',
    spotlightCopy:
      'Our signature dim-sum icon. Hand-sculpted top pleats, rosy cheeks, and an ultra-dense memory-foam core that takes a full 40 seconds to float back up.',
    image: '/assets/images/product-dumpling.svg',
    alt: 'Steamed Dumpling Squishy — pastel bao with a happy face',
    badge: 'Fan Fave ★',
    badgeClass: 'badge--pink',
    riseTime: '40s Slow-Rise',
    feel: 'Velvet Cloud TPR',
    scentNote: 'Warm Vanilla Bao',
    softness: 98,
    rebound: 95,
    relief: 99,
    quote: 'Hehe, bao-tiful squish!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 224, 206, 0.72), rgba(255, 158, 198, 0.25) 55%, transparent 75%)',
    accentColor: '#ffb6d5',
  },
  {
    slug: 'cheese',
    edition: '02',
    name: 'Cheese Cube Squishy',
    shortName: 'Cheese Cube',
    category: 'food',
    subTag: 'savory',
    description: 'Cuboid slow-rise memory foam with Swiss pockets',
    spotlightCopy:
      'Chunky golden cheddar geometry with sculpted air pockets that give your fingertips extra grip for deep, satisfying desk squeezes.',
    image: '/assets/images/product-cheese.svg',
    alt: 'Cheese Cube Squishy — cuboid slow-rise memory foam',
    badge: 'New Drop',
    badgeClass: 'badge--purple',
    riseTime: '36s Slow-Rise',
    feel: 'Whipped Cheddar Foam',
    scentNote: 'Sweet Cream Butter',
    softness: 94,
    rebound: 92,
    relief: 96,
    quote: 'Say cheese and squeeze!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 241, 168, 0.76), rgba(251, 200, 82, 0.24) 55%, transparent 75%)',
    accentColor: '#ffe07d',
  },
  {
    slug: 'catpaw',
    edition: '03',
    name: 'Cat Paw Squishy',
    shortName: 'Cat Paw',
    category: 'animal',
    subTag: 'animal',
    description: 'Plush pink jelly toe beans, ultra soft',
    spotlightCopy:
      'Four chubby pink toe beans and a heart-shaped palm pad. Designed to fit right in the center of your palm for instant study-break comfort.',
    image: '/assets/images/product-catpaw.svg',
    alt: 'Cat Paw Squishy — pink paw pads, ultra soft',
    badge: 'So Cute ♥',
    badgeClass: 'badge--pink',
    riseTime: '38s Slow-Rise',
    feel: 'Mochi Jelly Pad',
    scentNote: 'Strawberry Milk',
    softness: 99,
    rebound: 94,
    relief: 98,
    quote: 'Meow~ squish my toe beans!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 210, 234, 0.78), rgba(244, 134, 184, 0.28) 55%, transparent 75%)',
    accentColor: '#ff9ec7',
  },
  {
    slug: 'toast',
    edition: '04',
    name: 'Pastel Toast Squishy',
    shortName: 'Pastel Toast',
    category: 'food',
    subTag: 'bakery',
    description: 'Golden-crust milk bread slice, two-hand squish',
    spotlightCopy:
      'Thick-cut Japanese shokupan toast with a golden crust rim and pillowy center. Wide enough for a full two-handed crush.',
    image: '/assets/images/product-toast.svg',
    alt: 'Pastel Toast Squishy — pastel square toast, 4 colors',
    badge: 'Trending 🔥',
    badgeClass: 'badge--peach',
    riseTime: '42s Slow-Rise',
    feel: 'Fluffy Brioche Core',
    scentNote: 'Toasted Honey Milk',
    softness: 96,
    rebound: 97,
    relief: 95,
    quote: 'Toasty warm study hugs!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 232, 194, 0.75), rgba(235, 174, 108, 0.25) 55%, transparent 75%)',
    accentColor: '#ffd199',
  },
  {
    slug: 'butter',
    edition: '05',
    name: 'Butter Stick Squishy',
    shortName: 'Butter Stick',
    category: 'food',
    subTag: 'bakery',
    description: 'Salted sweet-cream butter block, pink & gold',
    spotlightCopy:
      'Wrapped in a kawaii pastel-pink cream band, this smooth pat of salted sweet cream melts under your thumb and rises back in slow motion.',
    image: '/assets/images/product-butter.svg',
    alt: 'Butter Stick Squishy — salted butter block, pink and yellow',
    badge: 'New Drop',
    badgeClass: 'badge--purple',
    riseTime: '36s Slow-Rise',
    feel: 'Silky Cream Block',
    scentNote: 'Salted Caramel Cream',
    softness: 95,
    rebound: 93,
    relief: 97,
    quote: 'You’re so butter-ful!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 238, 175, 0.76), rgba(255, 166, 206, 0.28) 55%, transparent 75%)',
    accentColor: '#ffe699',
  },
  {
    slug: 'peanut',
    edition: '06',
    name: 'Peanut Squishy',
    shortName: 'Peanut',
    category: 'food',
    subTag: 'savory',
    description: 'Textured figure-8 shell, mega squeezable',
    spotlightCopy:
      'Ergonomic twin-lobe peanut shell with a woven lattice texture that massages your fingers while you code, read, or cram for exams.',
    image: '/assets/images/product-peanut.svg',
    alt: 'Peanut Squishy — textured shell, mega squeezable',
    badge: 'Bestseller ★',
    badgeClass: 'badge--mint',
    riseTime: '45s Slow-Rise',
    feel: 'Textured Ribbed Shell',
    scentNote: 'Roasted Honey Nut',
    softness: 93,
    rebound: 98,
    relief: 97,
    quote: 'Go nuts and squeeze me!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(247, 224, 188, 0.75), rgba(210, 160, 105, 0.26) 55%, transparent 75%)',
    accentColor: '#f3cfa0',
  },
];

function formatPeso(value) {
  return `₱${Number(value || 0).toLocaleString('en-PH', {
    maximumFractionDigits: 2,
  })}`;
}

function getCatalogArray(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.products)) return result.products;
  return [];
}

export default function Shop() {
  const [products, setProducts] = useState(
    () => SquishiesAPI.getCachedProducts?.() || FALLBACK_PRODUCTS
  );
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [gridDensity, setGridDensity] = useState('showcase'); // 'showcase' (2-up huge) | 'gallery' (3-up)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(3);

  // 3D Spotlight Carousel state
  const [activeSlide, setActiveSlide] = useState(0);
  const [spotlightQty, setSpotlightQty] = useState(1);
  const [squishPulses, setSquishPulses] = useState({});
  const [activeQuote, setActiveQuote] = useState('');
  const quoteTimerRef = useRef(null);

  const { addToCart, syncProducts, showToast } = useCart();

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const result = await SquishiesAPI.fetchProducts();
        const catalog = getCatalogArray(result);

        if (cancelled || catalog.length === 0) return;

        setProducts(catalog);
        syncProducts(catalog);
      } catch (error) {
        if (cancelled) return;
        console.warn('Using fallback Squishies catalog:', error.message);
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [syncProducts]);

  useEffect(() => {
    return () => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    };
  }, []);

  const productsBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products]
  );

  const spotlightItem = shopProducts[activeSlide] || shopProducts[0];
  const spotlightProduct = productsBySlug.get(spotlightItem.slug);
  const spotlightStock = Number(spotlightProduct?.stockQuantity ?? 100);
  const spotlightUnavailable = !spotlightProduct || spotlightStock <= 0;

  function triggerSquish(item) {
    setSquishPulses((prev) => ({
      ...prev,
      [item.slug]: (prev[item.slug] || 0) + 1,
    }));
    setActiveQuote(item.quote);
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    quoteTimerRef.current = setTimeout(() => {
      setActiveQuote('');
    }, 2400);

    try {
      const idx = Math.floor(Math.random() * 5);
      const audio = new Audio(`/assets/voices/${item.slug}-${idx}.mp3`);
      audio.volume = 0.75;
      audio.play().catch(() => {});
    } catch {
      // Ignore audio errors when autoplay is blocked
    }
  }

  function stepCarousel(delta) {
    setActiveSlide((prev) => (prev + delta + shopProducts.length) % shopProducts.length);
    setSpotlightQty(1);
    setActiveQuote('');
  }

  function selectSlide(index) {
    setActiveSlide(index);
    setSpotlightQty(1);
    setActiveQuote('');
  }

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return shopProducts.filter((item) => {
      const matchesCategory =
        category === 'all' ||
        item.category === category ||
        item.subTag === category;

      const matchesSearch =
        !query ||
        `${item.name} ${item.description} ${item.category} ${item.feel} ${item.scentNote}`
          .toLowerCase()
          .includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [search, category]);

  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedProducts = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return visibleProducts.slice(start, start + pageSize);
  }, [visibleProducts, safePage, pageSize]);

  function handleAddToCart(slug, quantity = 1) {
    const product = productsBySlug.get(slug);

    if (!product) {
      showToast('This product could not be loaded. Please refresh.');
      return;
    }

    if (product.stockQuantity <= 0) {
      showToast('Sorry, this product is out of stock.');
      return;
    }

    addToCart(product, quantity);
  }

  return (
    <div className="shop-jelly">
      {/* ============ 3D SPOTLIGHT RUNWAY CAROUSEL ============ */}
      <section className="shop-hero shop-hero--runway" aria-label="3D Squishy Spotlight Carousel">
        <div className="container container--wide">
          <div className="section-head shop-runway__header">
            <span className="eyebrow eyebrow--pink">
              ★ Interactive 3D Collector’s Runway
            </span>
            <h1>Pick Your Squish</h1>
            <p>
              Spin, inspect, and squeeze every 3D edition in real time — crafted
              from slow-rising cloud TPR and memory foam.
            </p>
          </div>

          <div
            className="shop-carousel"
            style={{ '--spotlight-accent': spotlightItem.accentColor }}
          >
            <div className="shop-carousel__main">
              {/* LEFT: Huge 3D Interactive Stage */}
              <div className="shop-carousel__stage-wrap">
                <div
                  className="shop-carousel__aura"
                  style={{ background: spotlightItem.aura }}
                  aria-hidden="true"
                />
                <div className="shop-carousel__pedestal" aria-hidden="true" />

                <div className="shop-carousel__stage-top">
                  <span className="shop-carousel__edition-pill">
                    EDITION #{spotlightItem.edition} / 06
                  </span>
                  <span className={`badge ${spotlightItem.badgeClass}`}>
                    {spotlightItem.badge}
                  </span>
                </div>

                {activeQuote && (
                  <div className="shop-carousel__speech" role="status">
                    {activeQuote}
                  </div>
                )}

                <div className="shop-carousel__viewer">
                  <Suspense
                    fallback={
                      <img
                        src={spotlightItem.image}
                        alt={spotlightItem.alt}
                        width="460"
                        height="460"
                      />
                    }
                  >
                    <ProductViewer3D
                      key={spotlightItem.slug}
                      url={PRODUCT_MODELS[spotlightItem.slug]}
                      alt={spotlightItem.alt}
                      fallbackImage={spotlightItem.image}
                      compact
                      scaleBoost={1.08}
                      pulseSignal={squishPulses[spotlightItem.slug] || 0}
                    />
                  </Suspense>
                </div>

                {/* Prev / Next Carousel Paddles + Interactive Squish Trigger */}
                <div className="shop-carousel__stage-controls">
                  <button
                    type="button"
                    className="shop-carousel__arrow"
                    onClick={() => stepCarousel(-1)}
                    aria-label="Previous 3D squishy"
                  >
                    ← Prev
                  </button>

                  <button
                    type="button"
                    className="shop-carousel__squish-btn"
                    onClick={() => triggerSquish(spotlightItem)}
                  >
                    ✦ Squeeze 3D + Voice
                  </button>

                  <button
                    type="button"
                    className="shop-carousel__arrow"
                    onClick={() => stepCarousel(1)}
                    aria-label="Next 3D squishy"
                  >
                    Next →
                  </button>
                </div>
              </div>

              {/* RIGHT: Tactile Telemetry & Quick-Buy Panel */}
              <div className="shop-carousel__details">
                <div className="shop-carousel__chips">
                  <span className="spec-chip">{spotlightItem.riseTime}</span>
                  <span className="spec-chip">{spotlightItem.feel}</span>
                  <span className="spec-chip">✦ {spotlightItem.scentNote}</span>
                </div>

                <h2 className="shop-carousel__title">
                  <Link to={`/product.html?slug=${spotlightItem.slug}`}>
                    {spotlightItem.name}
                  </Link>
                </h2>

                <p className="shop-carousel__copy">
                  {spotlightItem.spotlightCopy}
                </p>

                {/* 3-Bar Squish-o-Meter */}
                <div className="shop-telemetry" aria-label="Squish sensory ratings">
                  <div className="shop-telemetry__row">
                    <div className="shop-telemetry__label">
                      <span>Cloud Softness</span>
                      <strong>{spotlightItem.softness}%</strong>
                    </div>
                    <div className="shop-telemetry__track">
                      <div
                        className="shop-telemetry__fill"
                        style={{ width: `${spotlightItem.softness}%` }}
                      />
                    </div>
                  </div>

                  <div className="shop-telemetry__row">
                    <div className="shop-telemetry__label">
                      <span>Slow-Rise Rebound</span>
                      <strong>{spotlightItem.rebound}%</strong>
                    </div>
                    <div className="shop-telemetry__track">
                      <div
                        className="shop-telemetry__fill shop-telemetry__fill--lavender"
                        style={{ width: `${spotlightItem.rebound}%` }}
                      />
                    </div>
                  </div>

                  <div className="shop-telemetry__row">
                    <div className="shop-telemetry__label">
                      <span>Desk Stress Relief</span>
                      <strong>{spotlightItem.relief}%</strong>
                    </div>
                    <div className="shop-telemetry__track">
                      <div
                        className="shop-telemetry__fill shop-telemetry__fill--mint"
                        style={{ width: `${spotlightItem.relief}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="shop-carousel__price-row">
                  <div className="shop-carousel__price-block">
                    <span className="shop-carousel__price-label">Collector Price</span>
                    <strong className="shop-carousel__price">
                      {spotlightProduct ? formatPeso(spotlightProduct.price) : '₱89'}
                    </strong>
                  </div>

                  <span className="shop-carousel__stock-pill">
                    {spotlightUnavailable
                      ? 'Out of stock'
                      : `✓ ${spotlightStock} in stock · Ready to ship`}
                  </span>
                </div>

                <div className="shop-carousel__cta-row">
                  <div className="shop-carousel__qty" aria-label="Quantity">
                    <button
                      type="button"
                      onClick={() => setSpotlightQty((q) => Math.max(1, q - 1))}
                      disabled={spotlightUnavailable || spotlightQty <= 1}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span>{spotlightQty}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSpotlightQty((q) => Math.min(99, spotlightStock, q + 1))
                      }
                      disabled={spotlightUnavailable || spotlightQty >= spotlightStock}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn btn--pink btn--lg shop-carousel__buy-btn"
                    disabled={spotlightUnavailable}
                    onClick={() => handleAddToCart(spotlightItem.slug, spotlightQty)}
                  >
                    {spotlightUnavailable
                      ? 'Out of Stock'
                      : `+ Add ${spotlightQty > 1 ? `${spotlightQty} ` : ''}to Bag`}
                  </button>

                  <Link
                    to={`/product.html?slug=${spotlightItem.slug}`}
                    className="btn btn--outline btn--lg shop-carousel__studio-btn"
                  >
                    Full 3D Studio →
                  </Link>
                </div>
              </div>
            </div>

            {/* BOTTOM: 6-Character Carousel Dock */}
            <div
              className="shop-carousel__dock"
              role="tablist"
              aria-label="Choose a 3D squishy in the spotlight carousel"
            >
              {shopProducts.map((item, idx) => {
                const isSelected = idx === activeSlide;
                const prod = productsBySlug.get(item.slug);
                return (
                  <button
                    key={item.slug}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={`shop-carousel__thumb${isSelected ? ' is-active' : ''}`}
                    onClick={() => selectSlide(idx)}
                  >
                    <span className="shop-carousel__thumb-num">#{item.edition}</span>
                    <img
                      src={item.image}
                      alt=""
                      width="44"
                      height="36"
                      loading="lazy"
                    />
                    <span className="shop-carousel__thumb-text">
                      <strong>{item.shortName}</strong>
                      <small>{prod ? formatPeso(prod.price) : '₱89'}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ============ ALL 3D EDITIONS SHOWROOM GRID ============ */}
      <section className="shop-grid-section">
        <div className="container container--wide">
          <div className="shop-catalog-bar">
            <div className="shop-catalog-bar__title">
              <h2>All 3D Squishy Editions</h2>
              <p>Every card is a live 3D stage — drag to spin or tap Squish 3D.</p>
            </div>

            <div className="shop-controls">
              <div className="search-field">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                    stroke="#B7ADC0"
                    strokeWidth="2"
                  />
                  <path
                    d="M20 20l-4.5-4.5"
                    stroke="#B7ADC0"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>

                <input
                  type="search"
                  id="shopSearch"
                  placeholder="Search 3D squishies, scents, textures…"
                  aria-label="Search squishies"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div
                className="filter-pills"
                id="filterPills"
                role="group"
                aria-label="Filter by category"
              >
                {[
                  { value: 'all', label: 'All (6)' },
                  { value: 'food', label: 'Food' },
                  { value: 'animal', label: 'Animal' },
                  { value: 'bakery', label: 'Sweet Bakery' },
                  { value: 'savory', label: 'Savory Bites' },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={`filter-pill ${
                      category === filter.value ? 'is-active' : ''
                    }`}
                    aria-pressed={category === filter.value}
                    onClick={() => {
                      setCategory(filter.value);
                      setPage(1);
                    }}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div
                className="shop-density-toggle"
                role="group"
                aria-label="Card size layout"
              >
                <button
                  type="button"
                  className={`filter-pill ${
                    gridDensity === 'showcase' ? 'is-active' : ''
                  }`}
                  aria-pressed={gridDensity === 'showcase'}
                  onClick={() => setGridDensity('showcase')}
                >
                  XL 3D Cards
                </button>
                <button
                  type="button"
                  className={`filter-pill ${
                    gridDensity === 'gallery' ? 'is-active' : ''
                  }`}
                  aria-pressed={gridDensity === 'gallery'}
                  onClick={() => setGridDensity('gallery')}
                >
                  3-Up Grid
                </button>
              </div>
            </div>
          </div>

          <div
            className={`product-grid product-grid--shop product-grid--shop-3d${
              gridDensity === 'showcase' ? ' product-grid--shop-xl' : ''
            }`}
            id="shopGrid"
          >
            {paginatedProducts.map((item) => {
              const product = productsBySlug.get(item.slug);
              const unavailable = !product || product.stockQuantity <= 0;
              const modelUrl = PRODUCT_MODELS[item.slug];
              const pulseCount = squishPulses[item.slug] || 0;

              let buttonText = '+ Add to Cart';

              if (!product) buttonText = 'Unavailable';
              else if (product.stockQuantity <= 0) {
                buttonText = 'Out of stock';
              }

              return (
                <article
                  className="product-card product-card--3d product-card--shop-3d"
                  data-category={item.category}
                  data-name={item.name.toLowerCase()}
                  key={item.slug}
                  onPointerEnter={() =>
                    SquishiesAPI.prefetchProduct?.(item.slug)
                  }
                >
                  <div
                    className="product-card__media product-card__media--3d product-card__media--shop-3d"
                    style={{ '--card-aura': item.aura }}
                  >
                    <div className="product-card__aura" aria-hidden="true" />
                    <div className="product-card__pedestal" aria-hidden="true" />

                    {modelUrl ? (
                      <Suspense
                        fallback={
                          <img
                            src={item.image}
                            alt={item.alt}
                            width="420"
                            height="340"
                            loading="lazy"
                          />
                        }
                      >
                        <ProductViewer3D
                          url={modelUrl}
                          alt={item.alt}
                          fallbackImage={item.image}
                          compact
                          scaleBoost={1.02}
                          pulseSignal={pulseCount}
                        />
                      </Suspense>
                    ) : (
                      <img
                        src={item.image}
                        alt={item.alt}
                        width="420"
                        height="340"
                        loading="lazy"
                      />
                    )}

                    <span className="shop-card__edition">#{item.edition}</span>

                    <span className={`badge ${item.badgeClass}`}>
                      {item.badge}
                    </span>

                    <button
                      type="button"
                      className="squish-3d-btn"
                      onClick={() => triggerSquish(item)}
                      aria-label={`Squish ${item.name} in 3D`}
                    >
                      ✦ Squish 3D
                    </button>
                  </div>

                  <div className="product-card__body product-card__body--shop-3d">
                    <div className="product-card__specs-row">
                      <span className="spec-chip">{item.riseTime}</span>
                      <span className="spec-chip">{item.feel}</span>
                      <span className="spec-chip">{item.scentNote}</span>
                    </div>

                    <h3>
                      <Link to={`/product.html?slug=${item.slug}`}>
                        {item.name}
                      </Link>
                    </h3>

                    <p className="product-card__desc">{item.description}</p>

                    <div
                      className="softness-meter"
                      aria-label={`Softness rating ${item.softness}%`}
                    >
                      <div className="softness-meter__label">
                        <span>Squish Softness</span>
                        <strong>{item.softness}%</strong>
                      </div>
                      <div className="softness-meter__track">
                        <div
                          className="softness-meter__fill"
                          style={{ width: `${item.softness}%` }}
                        />
                      </div>
                    </div>

                    <div className="product-card__footer product-card__footer--shop">
                      <div className="product-card__price-stack">
                        <span className="price">
                          {product ? formatPeso(product.price) : '—'}
                        </span>
                        <span className="shop-card__stock-note">
                          {unavailable
                            ? 'Out of stock'
                            : `${product.stockQuantity} available`}
                        </span>
                      </div>

                      <div className="product-card__btns">
                        <Link
                          className="btn btn--outline btn--sm"
                          to={`/product.html?slug=${item.slug}`}
                        >
                          3D Studio
                        </Link>

                        <button
                          type="button"
                          className="btn btn--pink btn--sm add-to-cart"
                          data-slug={item.slug}
                          disabled={unavailable}
                          onClick={() => handleAddToCart(item.slug)}
                        >
                          {buttonText}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {visibleProducts.length === 0 ? (
            <p className="shop-empty" id="shopEmpty">
              No squishies match your search. Try a different keyword or
              filter.
            </p>
          ) : (
            <PaginationBar
              page={safePage}
              totalPages={totalPages}
              totalItems={visibleProducts.length}
              pageSize={pageSize}
              pageSizeOptions={[3, 6]}
              onPageSizeChange={(nextSize) => {
                setPageSize(nextSize);
                setPage(1);
              }}
              onPageChange={(nextPage) => {
                setPage(nextPage);
              }}
              itemLabel="3D squishies"
            />
          )}
        </div>
      </section>
    </div>
  );
}
