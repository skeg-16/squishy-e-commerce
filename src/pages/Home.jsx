import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SquishiesAPI } from '../services/api';
import { useCart } from '../context/CartContext';

const featuredProducts = [
  {
    slug: 'dumpling',
    name: 'Steamed Dumpling Squishy',
    description: 'Pastel bao with a happy face',
    image: '/assets/images/product-dumpling.svg',
    alt: 'Steamed Dumpling Squishy — pastel bao with a happy face',
    badge: 'Fan Fave',
    badgeClass: 'badge--pink',
  },
  {
    slug: 'catpaw',
    name: 'Cat Paw Squishy',
    description: 'Pink paw pads, ultra soft',
    image: '/assets/images/product-catpaw.svg',
    alt: 'Cat Paw Squishy — pink paw pads, ultra soft',
    badge: 'So Cute',
    badgeClass: 'badge--pink',
  },
  {
    slug: 'peanut',
    name: 'Peanut Squishy',
    description: 'Textured shell, mega squeezable',
    image: '/assets/images/product-peanut.svg',
    alt: 'Peanut Squishy — textured shell, mega squeezable',
    badge: 'Bestseller',
    badgeClass: 'badge--mint',
  },
];

const promoSets = [
  {
    slug: 'solo-squish',
    name: 'Solo Squish',
    meta: '1 Squishy',
    description: 'A classic first squish: one smiling Dumpling.',
    items: [
      '1 Dumpling Squishy',
      'Individual gift pouch',
      'Sticker included',
    ],
    button: 'Get One',
    buttonClass: 'btn--lavender',
    image: '/assets/images/product-dumpling.svg',
  },
  {
    slug: 'stress-free-trio',
    name: 'Stress-Free Trio',
    meta: '3 Squishies',
    description: 'One for desk, one for bag, one for gifting.',
    items: [
      'Dumpling, Cat Paw & Peanut',
      'Ribbon-tied gift box',
      '2 bonus stickers',
    ],
    button: 'Get the Trio',
    buttonClass: 'btn--pink',
    image: '/assets/images/product-catpaw.svg',
    savings: 'Save ₱18',
    oldPrice: 267,
  },
  {
    slug: 'collectors-box',
    name: "Collector's Box",
    meta: '6 Different Designs',
    description: 'The full experience. Six unique designs, curated for you.',
    items: [
      '6 unique Squishies',
      'Keepsake collector box',
      'Full sticker sheet',
      'Mystery bonus item',
    ],
    button: 'Build My Collection',
    buttonClass: 'btn--dark',
    image: '/assets/images/hero-collage.svg',
    featured: true,
    savings: 'Free Sticker Sheet',
  },
  {
    slug: 'party-pack',
    name: 'Wholesale / Party Pack',
    meta: '20 Squishies',
    description: 'Events, giveaways, or reselling. Bulk pricing, full variety.',
    items: [
      '4 Dumplings, 4 Cat Paws & 3 each of the other designs',
      'Bulk poly bag packaging',
      'Custom note option',
      'Priority dispatch',
    ],
    button: 'Order in Bulk',
    buttonClass: 'btn--peach',
    image: '/assets/images/product-peanut.svg',
  },
];

const fallbackImages = {
  ...Object.fromEntries(
    featuredProducts.map((product) => [product.slug, product.image])
  ),
  ...Object.fromEntries(
    promoSets.map((product) => [product.slug, product.image])
  ),
};

function formatPeso(value) {
  return `₱${Number(value || 0).toLocaleString('en-PH', {
    maximumFractionDigits: 2,
  })}`;
}

function getImage(product, fallback) {
  const image = product?.image || product?.imageUrl || product?.image_url;

  if (!image) return fallback;
  if (/^(https?:\/\/|\/)/i.test(image)) return image;

  return `/${image.replace(/^\.?\//, '')}`;
}

function getCatalogArray(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.products)) return result.products;
  return [];
}

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const { addToCart, syncProducts, showToast } = useCart();

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const result = await SquishiesAPI.fetchProducts();
        const catalog = getCatalogArray(result);

        if (cancelled) return;

        setProducts(catalog);
        syncProducts(catalog);
        setLoadError(false);
      } catch (error) {
        if (cancelled) return;

        console.error('Failed to load Squishies catalog:', error);
        setLoadError(true);
        showToast(
          'The store could not load live inventory. Please refresh to try again.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [syncProducts, showToast]);

  const productsBySlug = new Map(
    products.map((product) => [product.slug, product])
  );

  function handleAddToCart(slug) {
    const product = productsBySlug.get(slug);

    if (!product) {
      showToast('This product could not be loaded. Please refresh.');
      return;
    }

    addToCart(product);
  }

  function getProductName(product, fallbackName) {
    return product?.name || fallbackName;
  }

  function getProductPrice(product) {
    return product ? formatPeso(product.price) : '—';
  }

  function isUnavailable(product) {
    return (
      loading ||
      loadError ||
      !product ||
      product.stockQuantity <= 0
    );
  }

  function getAddButtonText(product, normalText) {
    if (loading && !product) return 'Loading…';
    if (!product || loadError) return 'Unavailable';
    if (product.stockQuantity <= 0) return 'Out of stock';
    return normalText;
  }

  return (
    <>
      {/* ============ HERO ============ */}
      <section className="hero" id="hero">
        <div
          className="hero__blob hero__blob--purple"
          aria-hidden="true"
        />
        <div
          className="hero__blob hero__blob--pink"
          aria-hidden="true"
        />
        <div className="hero__dot" aria-hidden="true" />

        <div className="container hero__inner">
          <div className="hero__copy">
            <span className="eyebrow eyebrow--pink">
              + Premium TPR + Memory Foam
            </span>

            <h1 className="hero__title">
              Squeeze the
              <br />
              <span className="text-pink">Stress</span> Away.
            </h1>

            <p className="hero__desc">
              Cute, ultra-soft, slow-rising Squishies made for your study
              breaks, desk moments, and everyday smiles.
            </p>

            <Link to="/shop.html" className="btn btn--pink btn--lg">
              Pick Your Squish →
            </Link>

            <ul className="hero__badges">
              <li>Ages 3+</li>
              <li>Non-Toxic</li>
              <li>BPA-Free</li>
              <li>Hypoallergenic</li>
              <li>Low-Odor</li>
            </ul>
          </div>

          <div className="hero__media">
            <div className="hero__image-card">
              <img
                src="/assets/images/hero-collage.svg"
                alt="Six kawaii squishy toys: bread, peach, chick, cat, cloud, and bunny"
                width="420"
                height="420"
              />

              <span className="hero__tag hero__tag--soft">
                Ultra-soft
                <br />
                <strong>Slow-rising</strong>
              </span>

              <span className="hero__tag hero__tag--price">
                Starting from
                <br />
                <strong>₱89 only</strong>
              </span>
            </div>

            <div className="hero__scroll" aria-hidden="true">
              <span>SCROLL</span>
              <svg
                width="14"
                height="18"
                viewBox="0 0 14 18"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M7 0v16M1 11l6 6 6-6"
                  stroke="#B7ADC0"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ============ MOST SQUEEZED (PRODUCTS) ============ */}
      <section className="products" id="shop">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow eyebrow--pink">
              ★ Customer Favorites
            </span>
            <h2>Most Squeezed</h2>
            <p>The ones our customers keep coming back for.</p>
          </div>

          <div className="product-grid">
            {featuredProducts.map((featured) => {
              const product = productsBySlug.get(featured.slug);

              return (
                <article className="product-card" key={featured.slug}>
                  <div className="product-card__media">
                    <img
                      src={getImage(product, featured.image)}
                      alt={featured.alt}
                      width="400"
                      height="300"
                      loading="lazy"
                    />
                    <span
                      className={`badge ${featured.badgeClass}`}
                    >
                      {featured.badge}
                    </span>
                  </div>

                  <div className="product-card__body">
                    <h3>
                      <Link
                        to={`/product.html?slug=${encodeURIComponent(featured.slug)}`}
                      >
                        {getProductName(product, featured.name)}
                      </Link>
                    </h3>

                    <p className="product-card__desc">
                      {featured.description}
                    </p>

                    <div className="product-card__footer">
                      <span className="price">
                        {getProductPrice(product)}
                      </span>

                      <button
                        className="btn btn--pink btn--sm add-to-cart"
                        type="button"
                        disabled={isUnavailable(product)}
                        onClick={() => handleAddToCart(featured.slug)}
                      >
                        {getAddButtonText(product, '+ Add to Cart')}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="section-cta">
            <Link to="/shop.html" className="btn btn--outline">
              View All Squishies →
            </Link>
          </div>
        </div>
      </section>

      {/* ============ PROMO SETS ============ */}
      <section className="promo" id="promo">
        <div className="container">
          <div className="section-head">
            <h2>Promo Sets</h2>
            <p>More squish, more savings. Pick the set that fits you.</p>
          </div>

          {loadError && (
            <p role="status">
              Live bundle inventory is unavailable. Please refresh to try
              again.
            </p>
          )}

          <div className="promo-grid">
            {promoSets.map((bundle) => {
              const product = productsBySlug.get(bundle.slug);

              return (
                <article
                  className={`promo-card${bundle.featured ? ' promo-card--featured' : ''}`}
                  key={bundle.slug}
                >
                  {bundle.featured && (
                    <span className="badge badge--purple badge--pill">
                      Most Popular ★
                    </span>
                  )}

                  <div className="promo-card__body">
                    {bundle.savings && (
                      <span className="badge badge--mint badge--floating">
                        {bundle.savings}
                      </span>
                    )}

                    <h3>
                      {getProductName(product, bundle.name)}
                    </h3>

                    <p className="promo-card__meta">{bundle.meta}</p>

                    <p className="promo-card__price">
                      {getProductPrice(product)}
                      {bundle.oldPrice && (
                        <>
                          {' '}
                          <s>{formatPeso(bundle.oldPrice)}</s>
                        </>
                      )}
                    </p>

                    <p className="promo-card__desc">
                      {bundle.description}
                    </p>

                    <ul className="promo-card__list">
                      {bundle.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <button
                    className={`btn ${bundle.buttonClass} promo-card__btn add-to-cart`}
                    type="button"
                    disabled={isUnavailable(product)}
                    onClick={() => handleAddToCart(bundle.slug)}
                  >
                    {getAddButtonText(product, bundle.button)}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
